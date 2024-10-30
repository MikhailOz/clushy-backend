const express = require('express');
const axios = require('axios');
const client = require('../config/db');
const stripe = require('../utils/stripe');
const { ObjectId } = require('mongodb');

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Server is running');
});

router.post('/remindItemDrop', async (req, res) => {
  const { email, itemId } = req.body;
  try {
    const binResponse = await axios.get(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`, {
      headers: { 'X-Master-Key': process.env.JSONBIN_MASTER_KEY }
    });
    const existingData = binResponse.data.record;
    const itemExists = existingData.reminds.some(item => item.email === email && item.itemId === itemId);

    if (itemExists) return res.send({ status: 2001 });

    const dataToSave = { id: Date.now().toString(36) + Math.random().toString(36).substr(2), email, itemId };

    await axios.put(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`, {
      date: existingData.date,
      reminds: [...existingData.reminds, dataToSave]
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': process.env.JSONBIN_MASTER_KEY }
    });

    res.send({ status: 1000 });
  } catch (error) {
    res.send({ status: 2000 });
  }
});

router.get('/getInitialItemsAndSizes', async (req, res) => {
  try {
    const db = client.db('clushy');
    const items = await db.collection('items').find({}).toArray();
    const sizes = await db.collection('sizes').find({}).toArray();

    const itemsWithImages = items.map(item => ({
      ...item,
      imageUrl: `${process.env.PROTOCOL}://${process.env.SEVER_DOMAIN}:${process.env.PORT}/images/${item.imageFilename}`
    }));

    res.json({ status: 1000, message: [itemsWithImages, sizes] });
  } catch (error) {
    console.error(error);
    res.send({ status: 2000 });
  }
});

router.post('/createPaymentLink', async (req, res) => {
  const allowedCountries = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GI", "GR", "HU", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH", "GB"];
  const { itemId, sizeId } = req.body;
  const db = client.db('clushy');

  try {
    const items = await db.collection('items').find({}).toArray();
    const sizes = await db.collection('sizes').find({}).toArray();
    const item = items.find(i => i._id.toString() === itemId.toString());
    const size = sizes.find(i => i._id.toString() === sizeId.toString());

    if (!item || !size) return res.status(404).send({ status: 2003 });
    else if (item.sizes[sizeId] <= 0) return res.status(404).send({ status: 2004 });

    const stripePrices = await db.collection('stripe_prices').find({}).toArray();
    const priceKey = itemId + ':' + sizeId;
    let priceId = null;

    const existingPrice = stripePrices.find(sp => sp._id === priceKey);

    if (!existingPrice) {
      const name = `${item.title} ${size.full_name}`;
      //const thumb = `${process.env.PROTOCOL}://${process.env.SERVER_DOMAIN}:${process.env.PORT}/images/${item.thumb}`;
      //console.log(thumb);
      const price = await stripe.prices.create({
        currency: 'eur',
        unit_amount: item.price * 100,
        product_data: {
          name
        },
      });

      await db.collection('stripe_prices').updateOne(
        { _id: new ObjectId() },
        { $set: { key: priceKey, name, price_id: price.id } },
        { upsert: true }
      );
      priceId = price.id;
    } else {
      priceId = existingPrice.price_id;
    }

    if (!priceId) return res.status(500).send({ status: 2000 });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: allowedCountries },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.PROTOCOL}://${process.env.SERVER_DOMAIN}:${process.env.FRONTEND_PORT}/order`,
        }
      }
    });

    res.json({ status: 1000, message: paymentLink.url });
  } catch (error) {
    res.status(500).send({ status: 2000 });
  }
});

module.exports = router;
