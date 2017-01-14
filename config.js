{
  development: {
    port: 3000
  },
  production: {
    root: "./index.js",
    app: {
      name: "HitchBike"
    },
    port: process.env.port,
  }
}
