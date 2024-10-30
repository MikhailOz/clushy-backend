const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const itemRoutes = require('./routes/items');
const path = require('path');

dotenv.config();
const app = express();
const PORT = process.env.BACKEND_PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts')));
app.use('/fontsURL', require('./routes/fonts'));
app.use('/', itemRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on ${process.env.PROTOCOL}://${process.env.SERVER_DOMAIN}:${PORT}`);
});
