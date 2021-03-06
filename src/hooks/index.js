import _ from 'lodash'
import sift from 'sift'
import { getItems, when } from 'feathers-hooks-common'
import makeDebug from 'debug'
import { templateQueryObject } from '../utils'

// Feathers hooks
export * from 'feathers-hooks-common'
// Built-in hooks
export * from './hooks.auth'
export * from './hooks.clear'
export * from './hooks.csv'
export * from './hooks.docker'
export * from './hooks.grid'
export * from './hooks.json'
export * from './hooks.geojson'
export * from './hooks.mongo'
export * from './hooks.nwp'
export * from './hooks.ogc'
export * from './hooks.pg'
export * from './hooks.raster'
export * from './hooks.store'
export * from './hooks.system'
export * from './hooks.utils'
export * from './hooks.xml'
export * from './hooks.yaml'

const debug = makeDebug('krawler:hooks')
// Custom hooks
let hooks = {}

export function registerHook (hookName, hookFunction) {
  hooks[hookName] = hookFunction
}

export function unregisterHook (hookName) {
  delete hooks[hookName]
}

export function getHook (hookName) {
  return hooks[hookName]
}

export function parallel (hooks) {
  return async function (hookObject) {
    return Promise.all(hooks.map(hook => hook(hookObject))).then(_ => hookObject)
  }
}

export function getHookFunction (hookName) {
  // Jump from name to the real hook function
  // First built-in hooks
  let hook = hooks[hookName]
  // Then custom ones
  if (!hook) hook = getHook(hookName)
  if (typeof hook !== 'function') {
    let message = 'Unknown hook ' + hookName
    debug(message)
    throw new Error(message)
  }
  return hook
}

// Generate a predicate to be used in a when/iff clause
// that will skip the associated hook depending on configured properties
export function match (hookName, filter) {
  return function (hook) {
    // Retrieve the item from the hook
    let item = getItems(hook)
    const templatedFilter = templateQueryObject(item, filter)
    // Check if the hook has to be executed or not depending on its properties
    const execute = !_.isEmpty(sift(templatedFilter, [item]))
    if (!execute) debug('Skipping hook ' + hookName + ' due to filter', templatedFilter)
    else debug('Executing hook ' + hookName + ' not filtered by', templatedFilter)
    return execute
  }
}

function getFaultTolerantHook (hookFunction) {
  return function (hook) {
    try {
      return hookFunction(hook)
    } catch (error) {
      console.log(error)
      return hook
    }
  }
}

function addHook (hookName, hookOptions, pipeline) {
  // Jump from name/options to the real hook function
  let hook = getHookFunction(hookName)
  if (hookOptions.faultTolerant) {
    debug('Adding fault-tolerant hook for ' + hookName)
    hook = getFaultTolerantHook(hook)
  }
  // We have a default filter to skip hooks at some point in the chain
  let filter = { skip: { $exists: false } }
  // Take care that sometimes options is simply a string object and a match function do exist in this case
  const hookFilter = (typeof hookOptions === 'string' ? undefined : hookOptions.match)
  if (hookFilter) {
    debug('Adding hook ' + hookName + ' to hook chain with filter', filter)
    Object.assign(filter, hookFilter)
  } else debug('Adding hook ' + hookName + ' to hook chain')
  // Add filtering options to hook
  hook = when(match(hookName, filter), hook(hookOptions))
  pipeline.push(hook)
}

export function activateHooks (serviceHooks, service) {
  let feathersHooks = {}
  // Iterate over hook types (before, after)
  _.forOwn(serviceHooks, (hooksDefinition, stage) => {
    // Iterate over hooks to create the hook pipeline
    let pipeline = []
    _.forOwn(hooksDefinition, (hookOptions, hookName) => {
      // Check for parallel execution hook
      if (hookName === 'parallel') {
        try {
          debug('Adding parallel hook to hook chain with following hooks')
          // In this case we have an array of hooks to be run in parallel
          // Each item contains the hook name as a 'hook' property and hook options
          let hooks = []
          hookOptions.map(item => addHook(item.hook, item, hooks))
          pipeline.push(parallel(hooks))
        } catch (error) {
          console.error(error.message)
        }
      } else {
        // Jump from name/options to the real hook function
        try {
          // If hook name is given as 'hook' option property use it
          // otherwise us key as hook name
          hookName = _.get(hookOptions, 'hook', hookName)
          addHook(hookName, hookOptions, pipeline)
        } catch (error) {
          console.error(error.message)
        }
      }
    })
    feathersHooks[stage] = { create: pipeline } // We only have create operation to manage
  })
  // Setup hooks on service
  if (service) service.hooks(feathersHooks)
  return feathersHooks
}
