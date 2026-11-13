// Password per entrare nell'app (chi arriva dal link d'invito non ne ha bisogno).
// Vive solo nel server: non finisce mai nel codice che arriva al browser.
// Su Render si può cambiare con la variabile d'ambiente SCOPA_PASSWORD.
export const PASSWORD = process.env.SCOPA_PASSWORD ?? 'giorgiaseiscarsissima';
