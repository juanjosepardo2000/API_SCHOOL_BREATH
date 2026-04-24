const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')
const passport = require('passport')
const { jwt } = require('./passport')
const rateLimit = require('express-rate-limit')

//imports
const gamificationRoutes = require('../routes/gamification.routes');
const userRoutes = require('../routes/user.routes')
const authRoutes = require('../routes/auth.routes')
const projectRoutes = require('../routes/music.routes')
const purchaseRoutes = require('../routes/purchase.routes')
const contactRoutes = require('../routes/contact.routes')
const uploadRoutes = require('../routes/upload.routes')
const videosRoutes = require('../routes/video.routes')
const categories = require('../routes/categories.routes')
const appMusics = require('../routes/music.app.routes')
const courses = require('../routes/course.routes')
const coursesV2 = require('../routes/course.v2.routes')
const theme = require('../routes/theme.routes')
const review = require('../routes/review.routes')
const videoContent = require('../routes/video.content.routes')
const mantraRoutes = require('../routes/mantra.routes')
const mantraPlaylistRoutes = require('../routes/mantraPlaylist.routes')
const userMantraPlaylistRoutes = require('../routes/userMantraPlaylist.routes')
const { router: sseRoutes } = require('../routes/sse.routes')
const chatRoutes = require('../routes/chat/chat.route')
const chatVercelRoutes = require('../routes/chat/chat-vercel.route')
const tokenGeneratorRoutes = require('../routes/tokenGenerator.routes')
const systemVarsRoutes = require('../routes/systemVars.routes')
const envTestRoutes = require('../routes/envTest.routes')
const guideRoutes = require('../routes/guide.route')
const healthRoutes = require('../routes/health.routes')
const adminRoutes = require('../routes/admin.routes')
const analyticsRoutes = require('../routes/analytics.routes')
const revenuecatRoutes = require('../routes/revenuecat.routes')
const breathingTechniqueLevelsRoutes = require('../routes/breathingTechniqueLevels.routes')
const app = express()

// Trust proxy for rate limiting (required for Vercel deployment)
app.set('trust proxy', 1)

// Enable CORS for all routes
app.use(cors({origin:'*'}))

if (process.env.NODE_ENV == 'production') {
   
    app.use(cors({origin:'*'}))
    app.use(morgan('short'))
    app.use(helmet())
}
else {
    app.use(cors({origin:'*'}))
    app.use(morgan('dev'))
}

app.use(passport.initialize())
// RevenueCat webhook must receive raw bytes before JSON parser.
app.use('/webhooks/revenuecat', revenuecatRoutes)
app.use(express.json())
app.use(express.urlencoded({ extended: true}))

passport.use('jwt', jwt)

app.use('/gamification', gamificationRoutes)

// Basic rate limiting with proper proxy configuration
const authLimiter = rateLimit({ 
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (status < 400)
  skipSuccessfulRequests: false,
  // Skip failed requests (status >= 400)
  skipFailedRequests: false
})

app.use('/auth/social', authLimiter)
app.use('/auth/unlink', authLimiter)

app.use('/user', userRoutes)
app.use('/auth', authRoutes)
app.use('/musics', projectRoutes)
app.use('/purchases', purchaseRoutes)
app.use('/contact', contactRoutes)
app.use('/categories',categories )
app.use('/videos',videosRoutes )
app.use('/uploadFiles',uploadRoutes )
app.use('/app/musics',appMusics)
app.use('/courses',courses)
app.use('/courses-v2',coursesV2)
app.use('/themes',theme)
app.use('/reviews',review)
app.use('/video-content',videoContent)
// Playlist sub-routes MUST be mounted before /mantras to avoid /:id wildcard conflicts
app.use('/mantras/playlists', mantraPlaylistRoutes)
app.use('/mantras/user-playlist', userMantraPlaylistRoutes)
app.use('/mantras',mantraRoutes)
app.use('/eventos', sseRoutes)
app.use('/chat', chatRoutes)
app.use('/chat-vercel', chatVercelRoutes)
app.use('/system-vars', systemVarsRoutes)
app.use('/guides', guideRoutes)
app.use('/health', healthRoutes)
app.use('/admin', adminRoutes)
app.use('/analytics', analyticsRoutes)
app.use('/breathing-sessions', breathingTechniqueLevelsRoutes)

module.exports = app
