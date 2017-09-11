/**
 * Created by Wu Jian Ping on - 2017/09/06.
 */

import express from 'express'
import compression from 'compression'
import path from 'path'
import helmet from 'helmet'
import Context from './core/context'
import config from '../tools/config'
import assets from './assets-loader'
import createApp from './create-app'
import { createRenderer } from 'vue-server-renderer'

const PORT = process.env.PORT || config.backendPort || 9000
const app = express()

app.use(helmet())
app.use(compression())

app.use(express.static(path.join(__dirname, 'public')))

app.use((req, res, next) => {
  let context = new Context()
  req.context = context
  next()
})

// attach apis
require('./router-api')(app)

const renderer = createRenderer({
  template: `<!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Hello</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">
      {{{ assets.styles }}}
    </head>
    <body>
      <div id="app">
        <!--vue-ssr-outlet-->
      </div>
      {{{ assets.scripts }}}
    </body>
  </html>`
})

const render = context => {
  return new Promise((resolve, reject) => {
    const { app, router, store } = createApp()
    router.push(context.url)
    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents()
      if (!matchedComponents.length) {
        return reject({ code: 404 }) //eslint-disable-line
      }
      Promise
        .all(matchedComponents.map(Component => {
          if (Component.asyncData) {
            return Component.asyncData({
              store,
              route: router.currentRoute
            })
          }
        }))
        .then(() => {
          context.state = store.state
          resolve(app)
        })
        .catch(reject)
    }, reject)
  })
}

app.get('*', (req, res, next) => {
  const context = { url: req.url }
  render(context)
    .then(app => {
      context.assets = assets
      renderer.renderToString(app, context, (err, html) => {
        if (err) {
          if (err.code === 404) {
            res.status(404).send('Page not found')
          } else {
            res.status(500).send(err)
          }
        } else {
          res.send(html)
        }
      })
    })
})

let logger = console
app.listen(PORT, function(err) {
  if (err) {
    throw err
  }
  logger.log(`Listening at http://localhost:${PORT}/`) // eslint-disable-line
})
