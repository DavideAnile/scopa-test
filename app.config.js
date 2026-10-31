// Aggiunge a app.json l'indirizzo del server di gioco, passato da `npm run party` (SCOPA_SERVER).
// Il manifest viene letto a ogni avvio dell'app, quindi l'indirizzo è sempre quello attuale.
// Senza SCOPA_SERVER (es. su Render) il campo non c'è e la versione web usa l'indirizzo della pagina.
// Nota: un valore `null` qui diventerebbe `{}` nel manifest, per questo si omette del tutto.
module.exports = ({ config }) => {
  const gameServer = process.env.SCOPA_SERVER;
  return {
    ...config,
    extra: { ...config.extra, ...(gameServer ? { gameServer } : {}) },
  };
};
