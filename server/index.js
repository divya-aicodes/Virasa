import 'dotenv/config';
import app from './app.js';
import { assertProductionSecurity } from './lib/security.js';

const PORT = process.env.PORT || 3001;

assertProductionSecurity();

app.listen(PORT, () => {
  console.log(`Virasā server running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
});
