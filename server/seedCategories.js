import dns from 'node:dns'
import 'dotenv/config'
import mongoose from 'mongoose'
import Category from './models/Category.js'

// Use public DNS servers for MongoDB Atlas SRV resolution
dns.setServers([
  '8.8.8.8',
  '1.1.1.1',
])

const categories = [
  {
    name: 'Kurtis',
    sortOrder: 1,
  },
  {
    name: 'Sarees',
    sortOrder: 2,
  },
  {
    name: 'Dresses',
    sortOrder: 3,
  },
  {
    name: 'Tops',
    sortOrder: 4,
  },
  {
    name: 'Coord Sets',
    sortOrder: 5,
  },
  {
    name: 'Ethnic Wear',
    sortOrder: 6,
  },
]

function makeSlug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function seedCategories() {
  try {
    console.log('Connecting to MongoDB...')

    await mongoose.connect(process.env.MONGODB_URI)

    console.log('MongoDB connected successfully.')

    for (const category of categories) {
      const slug = makeSlug(category.name)

      const result = await Category.findOneAndUpdate(
        { slug },
        {
          name: category.name,
          slug,
          image: '',
          isActive: true,
          sortOrder: category.sortOrder,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      )

      console.log(
        `✓ ${result.name} | active: ${result.isActive} | order: ${result.sortOrder}`
      )
    }

    console.log('')
    console.log('====================================')
    console.log('KAVSI categories seeded successfully!')
    console.log('====================================')

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error('')
    console.error('Category seed failed:')
    console.error(error)

    try {
      await mongoose.disconnect()
    } catch {}

    process.exit(1)
  }
}

seedCategories()