import path from 'path'
import _ from 'lodash'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import makeDebug from 'debug'

const debug = makeDebug('krawler:hooks:yaml')

// Generate a YAML from specific hook result values
export function writeYAML (options = {}) {
  return async function (hook) {
    if (hook.type !== 'after') {
      throw new Error(`The 'writeYAML' hook should only be used as a 'after' hook.`)
    }

    let store = await getStoreFromHook(hook, 'writeYAML', options.storePath)
    if (!store.path) {
      throw new Error(`The 'writeYAML' hook only work with the fs blob store.`)
    }

    return new Promise((resolve, reject) => {
      debug('Creating YAML for ' + hook.data.id)

      const fileName = hook.data.id + '.yaml'
      const filePath = path.join(store.path, fileName)
      let yamlObject = yaml.safeDump(_.get(hook, options.dataPath || 'result.data'))
      fs.outputJson(filePath, yamlObject, {})
      .then(() => {
        addOutput(hook.result, fileName, options.outputType)
        resolve(hook)
      })
      .catch(reject)
    })
  }
}

// Generate a YAML from specific hook result values
export function readYAML (options = {}) {
  return async function (hook) {
    if (hook.type !== 'after') {
      throw new Error(`The 'readYAML' hook should only be used as a 'after' hook.`)
    }

    let store = await getStoreFromHook(hook, 'readYAML', options.storePath)
    if (!store.path) {
      throw new Error(`The 'readYAML' hook only work with the fs blob store.`)
    }

    debug('Creating YAML for ' + hook.data.id)
    const fileName = hook.data.id + '.yaml'
    const filePath = path.join(store.path, fileName)

    const yamlObject = await fs.readFile(filePath)
    _.set(hook, options.dataPath || 'result.data', yaml.safeLoad(yamlObject))
    return hook
  }
}

