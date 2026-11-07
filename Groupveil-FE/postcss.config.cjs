// postcss.config.cjs (CommonJS)
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {
      config: './tailwind.config.cjs'
    },// 👈 Updated plugin name
    autoprefixer: {},
  }
}