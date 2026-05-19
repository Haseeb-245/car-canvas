const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const logFile = 'c:\\Users\\Haseeb Irfan\\Desktop\\car canvas\\frontend\\src\\components\\debug.log';

// Reset log file on start
fs.writeFileSync(logFile, '=== BROWSER DEBUG LOGS ===\n');

app.post('/log', (req, res) => {
  const { type, msg } = req.body;
  const logLine = `[${type}] ${msg}`;
  console.log(logLine);
  fs.appendFileSync(logFile, logLine + '\n');
  res.sendStatus(200);
});

app.listen(8080, () => {
  console.log('Logging server running on port 8080');
});
