// Aggiunge a app.json l'indirizzo del server di gioco, passato da `npm run party` (SCOPA_SERVER).
// Il manifest viene letto a ogni avvio dell'app, quindi l'indirizzo è sempre quello attuale.
module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, gameServer: process.env.SCOPA_SERVER ?? null },
});
