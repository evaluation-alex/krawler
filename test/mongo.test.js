import chai, { util, expect } from 'chai'
import chailint from 'chai-lint'
import path from 'path'
import { hooks as pluginHooks } from '../src'

describe('krawler:mongo', () => {
  const geojson = require(path.join(__dirname, 'data', 'geojson'))

  before(() => {
    chailint(chai, util)
  })

  let mongoHook = {
    type: 'before',
    data: {},
    result: { data: geojson },
    params: {}
  }

  it('connect to MongoDB', async () => {
    await pluginHooks.connectMongo({ url: 'mongodb://127.0.0.1:27017/krawler-test' })(mongoHook)
    expect(mongoHook.data.client).toExist()
    expect(mongoHook.data.client.db).toExist()
    expect(mongoHook.data.client.isConnected()).beTrue()
  })
  // Let enough time to proceed
  .timeout(5000)

  it('creates MongoDB collection', async () => {
    await pluginHooks.createMongoCollection({ collection: 'geojson', index: { geometry: '2dsphere' } })(mongoHook)
    let collections = await mongoHook.data.client.db.listCollections({ name: 'geojson' }).toArray()
    expect(collections.length > 0).beTrue()
    expect(collections[0].name).to.equal('geojson')
  })
  // Let enough time to proceed
  .timeout(5000)

  it('writes MongoDB collection', async () => {
    mongoHook.type = 'after'
    await pluginHooks.writeMongoCollection({ collection: 'geojson' })(mongoHook)
    let collection = mongoHook.data.client.db.collection('geojson')
    let results = await collection.find({
      geometry: { $near: { $geometry: { type: 'Point', coordinates: [ 102, 0.5 ] }, $maxDistance: 5000 } }
    }).toArray()
    expect(results.length > 0).beTrue()
    expect(results[0].properties).toExist()
    expect(results[0].properties.prop0).to.equal('value0')
  })
  // Let enough time to proceed
  .timeout(5000)

  it('drops MongoDB collection', async () => {
    await pluginHooks.dropMongoCollection({ collection: 'geojson' })(mongoHook)
    let collections = await mongoHook.data.client.db.listCollections({ name: 'geojson' }).toArray()
    expect(collections.length === 0).beTrue()
  })
  // Let enough time to proceed
  .timeout(5000)

  it('disconnect from MongoDB', async () => {
    await pluginHooks.disconnectMongo()(mongoHook)
    expect(mongoHook.data.client).beUndefined()
  })
  // Let enough time to proceed
  .timeout(5000)
})
