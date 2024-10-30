const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const getFontWeight = (suffix) => {
  switch (suffix.toLowerCase()) {
    case 'thin': return '100';
    case 'extralight': return '200';
    case 'light': return '300';
    case 'regular': return '400';
    case 'medium': return '500';
    case 'semibold': return '600';
    case 'bold': return '700';
    case 'extrabold': return '800';
    case 'black': return '900';
    default: return '400';
  }
};

router.get('/:fontName', (req, res) => {
  const { fontName } = req.params;
  const fontsDir = path.join(__dirname, '../public/fonts');

  fs.readdir(fontsDir, (err, files) => {
    if (err) return res.status(500).json({ message: 'Error reading font directory' });

    const fontFiles = files
      .filter(file => file.startsWith(fontName) && file.endsWith('.ttf'))
      .map(file => {
        const styleSuffix = file.replace(`${fontName}-`, '').replace('.ttf', '');
        const weight = getFontWeight(styleSuffix.replace(/italic/i, ''));
        const isItalic = /italic/i.test(styleSuffix);
        return {
          weight,
          style: isItalic ? 'italic' : 'normal',
          url: `${req.protocol}://${req.get('host')}/fonts/${file}`,
        };
      });

    if (fontFiles.length === 0) {
      return res.status(404).json({ message: 'Font not found' });
    }

    res.json({ fontName, styles: fontFiles });
  });
});

module.exports = router;
