import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createRouter } from './routes'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/v1/health', (req, res) => res.json({ ok: true }))
app.use('/api/v1', createRouter())

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {})
