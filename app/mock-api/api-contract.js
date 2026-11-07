/**
 * Phase 38 public API DTO contract and dependency-free validators.
 * Contract is a reference for frontend/backend alignment, not a production schema migration.
 */
'use strict';

const API_VERSION = 'v1';
const SCHEDULE_TYPES = Object.freeze(['food_truck', 'stall']);

const DTO_SCHEMA = Object.freeze({
  catalogItem: {
    required: ['product_id', 'name', 'category', 'price', 'currency', 'available'],
    optional: ['description', 'spec', 'image_url'],
    category: ['lianggao', 'radish_cake']
  },
  contentSection: {
    required: ['title', 'content', 'image_url', 'published']
  },
  schedule: {
    required: ['schedule_id', 'type', 'service_date', 'title', 'region', 'start_time', 'end_time', 'flavors'],
    flavorRequired: ['flavor_id', 'name'],
    foodTruckFlavorOptional: ['price', 'currency'],
    stallFlavorForbidden: ['price', 'currency']
  },
  pagination: {
    required: ['items', 'next_cursor']
  },
  successMeta: {
    required: ['request_id', 'api_version']
  },
  error: {
    required: ['code', 'message', 'field_errors', 'retryable']
  }
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isNullableNonNegativeInteger(value) {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

function validateCatalogItem(item, path = 'item') {
  const errors = [];
  if (!isObject(item)) return [`${path} 必須是物件`];
  for (const key of DTO_SCHEMA.catalogItem.required) {
    if (!(key in item)) errors.push(`${path} 缺少 ${key}`);
  }
  for (const key of ['product_id', 'name', 'currency']) {
    if (key in item && !isString(item[key])) errors.push(`${path}.${key} 必須是字串`);
  }
  if (item.category && !DTO_SCHEMA.catalogItem.category.includes(item.category)) errors.push(`${path}.category 不合法`);
  if ('price' in item && !isNullableNonNegativeInteger(item.price)) errors.push(`${path}.price 必須是非負整數或 null`);
  if ('available' in item && typeof item.available !== 'boolean') errors.push(`${path}.available 必須是布林值`);
  for (const key of ['description', 'spec', 'image_url']) {
    if (key in item && !isString(item[key])) errors.push(`${path}.${key} 必須是字串`);
  }
  return errors;
}

function validateContent(data) {
  const errors = [];
  if (!isObject(data)) return ['content 必須是物件'];
  for (const [section, value] of Object.entries(data)) {
    if (!isObject(value)) {
      errors.push(`content.${section} 必須是物件`);
      continue;
    }
    for (const key of DTO_SCHEMA.contentSection.required) {
      if (!(key in value)) errors.push(`content.${section} 缺少 ${key}`);
    }
    for (const key of ['title', 'content', 'image_url']) {
      if (key in value && !isString(value[key])) errors.push(`content.${section}.${key} 必須是字串`);
    }
    if ('published' in value && value.published !== true) errors.push(`content.${section}.published 必須為 true`);
  }
  return errors;
}

function validateSchedule(schedule, path = 'schedule') {
  const errors = [];
  if (!isObject(schedule)) return [`${path} 必須是物件`];
  for (const key of DTO_SCHEMA.schedule.required) {
    if (!(key in schedule)) errors.push(`${path} 缺少 ${key}`);
  }
  if (!SCHEDULE_TYPES.includes(schedule.type)) errors.push(`${path}.type 不合法`);
  for (const key of ['schedule_id', 'service_date', 'title', 'region', 'start_time', 'end_time']) {
    if (key in schedule && !isString(schedule[key])) errors.push(`${path}.${key} 必須是字串`);
  }
  if ('flavors' in schedule && !Array.isArray(schedule.flavors)) {
    errors.push(`${path}.flavors 必須是陣列`);
  } else if (Array.isArray(schedule.flavors)) {
    schedule.flavors.forEach((flavor, index) => {
      const flavorPath = `${path}.flavors[${index}]`;
      if (!isObject(flavor)) {
        errors.push(`${flavorPath} 必須是物件`);
        return;
      }
      for (const key of DTO_SCHEMA.schedule.flavorRequired) {
        if (!(key in flavor)) errors.push(`${flavorPath} 缺少 ${key}`);
      }
      for (const key of DTO_SCHEMA.schedule.flavorRequired) {
        if (key in flavor && !isString(flavor[key])) errors.push(`${flavorPath}.${key} 必須是字串`);
      }
      if (schedule.type === 'stall') {
        for (const key of DTO_SCHEMA.schedule.stallFlavorForbidden) {
          if (key in flavor) errors.push(`${flavorPath} 不得包含 ${key}`);
        }
      }
      if (schedule.type === 'food_truck' && 'price' in flavor && !isNullableNonNegativeInteger(flavor.price)) {
        errors.push(`${flavorPath}.price 必須是非負整數`);
      }
      if (schedule.type === 'food_truck' && 'currency' in flavor && flavor.currency !== 'TWD') {
        errors.push(`${flavorPath}.currency 必須是 TWD`);
      }
    });
  }
  return errors;
}

function validatePaginatedData(data, itemValidator, path = 'data') {
  if (!isObject(data)) return [`${path} 必須是物件`];
  const errors = [];
  if (!Array.isArray(data.items)) errors.push(`${path}.items 必須是陣列`);
  else data.items.forEach((item, index) => errors.push(...itemValidator(item, `${path}.items[${index}]`)));
  if (!('next_cursor' in data) || !(data.next_cursor === null || isString(data.next_cursor))) {
    errors.push(`${path}.next_cursor 必須是字串或 null`);
  }
  return errors;
}

function validateSuccessEnvelope(envelope, dataValidator) {
  const errors = [];
  if (!isObject(envelope)) return ['response 必須是物件'];
  if (!('data' in envelope)) errors.push('response 缺少 data');
  else errors.push(...dataValidator(envelope.data));
  if (!isObject(envelope.meta)) errors.push('response.meta 必須是物件');
  else {
    if (!isString(envelope.meta.request_id) || !envelope.meta.request_id) errors.push('response.meta.request_id 必須是非空字串');
    if (envelope.meta.api_version !== API_VERSION) errors.push('response.meta.api_version 必須是 v1');
  }
  return errors;
}

function validateErrorEnvelope(envelope) {
  const errors = [];
  if (!isObject(envelope) || !isObject(envelope.error) || !isObject(envelope.meta)) return ['error response 格式不正確'];
  for (const key of DTO_SCHEMA.error.required) {
    if (!(key in envelope.error)) errors.push(`error 缺少 ${key}`);
  }
  if (!isString(envelope.error.code) || !isString(envelope.error.message)) errors.push('error code/message 必須是字串');
  if (!Array.isArray(envelope.error.field_errors)) errors.push('error.field_errors 必須是陣列');
  if (typeof envelope.error.retryable !== 'boolean') errors.push('error.retryable 必須是布林值');
  if (!isString(envelope.meta.request_id) || !envelope.meta.request_id) errors.push('meta.request_id 必須是非空字串');
  if (envelope.meta.api_version !== API_VERSION) errors.push('meta.api_version 必須是 v1');
  return errors;
}

module.exports = {
  API_VERSION,
  DTO_SCHEMA,
  SCHEDULE_TYPES,
  validateCatalogItem,
  validateContent,
  validateErrorEnvelope,
  validatePaginatedData,
  validateSchedule,
  validateSuccessEnvelope
};
