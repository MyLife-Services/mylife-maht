import Koa from 'koa'
import serve from 'koa-static'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = new Koa()
const port = process.env.PORT ?? 3000
// Serve everything inside /views (HTML, CSS, JS, images, etc.)
app.use(serve(path.join(__dirname, 'views')))
// Start server
app.listen(port, ()=>{
  console.log(`Static server running on port ${ port }`)
})
