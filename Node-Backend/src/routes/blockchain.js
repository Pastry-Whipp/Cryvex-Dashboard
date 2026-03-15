const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Automatically read the blockchain config extracted by the Truffle deployment container
router.get('/config', (req, res) => {
  const configPath = path.join(__dirname, '..', '..', 'pipeline_configs', 'blockchain_config.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.status(404).json({ detail: 'Blockchain config not generated yet by Truffle' });
    }
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

module.exports = router;
