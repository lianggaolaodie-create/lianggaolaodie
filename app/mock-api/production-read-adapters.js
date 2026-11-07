/**
 * Phase 55 read-only adapters for the existing production data shapes.
 * Pure mapping only: no Supabase client, network calls, mutations or writes.
 * Every public object is built from an explicit allowlist.
 */
'use strict';

const text = value => typeof value === 'string' ? value.trim() : '';
const finiteMoney = value => Number.isFinite(Number(value)) && Number(value) >= 0;
const dateText = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

function mapFlavorCatalog(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row && row.enabled === true).map(row => ({
    id: row.id,
    productName: text(row.product_name),
    name: text(row.name),
    description: text(row.description),
    price: finiteMoney(row.price) ? Number(row.price) : null,
    imageUrl: text(row.image_url),
    flavorType: text(row.flavor_type),
    enabled: true
  }));
}

function mapDailyMenu({ setting, regions = [], items = [], todayTaipei } = {}) {
  if (!setting || setting.ordering_enabled !== true || !dateText(setting.order_date) ||
      !dateText(todayTaipei) || setting.order_date < todayTaipei) return null;
  const publicRegions = regions.filter(row => row && row.enabled === true &&
    row.order_date === setting.order_date && text(row.region_name)).map(row => text(row.region_name));
  const publicItems = items.filter(row => row && row.enabled === true &&
    row.order_date === setting.order_date && finiteMoney(row.price)).map(row => ({
      dailyFlavorId: row.id,
      flavorId: row.flavor_id,
      productName: text(row.product_name),
      flavorName: text(row.flavor_name),
      price: Number(row.price),
      enabled: true,
      available: row.quantity === null || row.quantity === undefined || Number(row.quantity) > 0
    }));
  return {
    orderDate: setting.order_date,
    orderingEnabled: true,
    regions: publicRegions,
    items: publicItems
  };
}

function mapSchedule({ schedule, links = [], flavorsById = {} } = {}) {
  if (!schedule || schedule.enabled !== true ||
      !['food_truck', 'stall'].includes(schedule.schedule_type) ||
      !dateText(schedule.schedule_date)) return null;
  const flavors = links.filter(link => link && link.schedule_id === schedule.id)
    .map(link => {
      const flavor = flavorsById[String(link.flavor_id)];
      if (!flavor || flavor.enabled !== true) return null;
      const item = { flavorId: link.flavor_id, name: text(flavor.name) };
      if (schedule.schedule_type === 'food_truck' && finiteMoney(link.price_per_box)) {
        item.pricePerBox = Number(link.price_per_box);
      }
      return item;
    }).filter(Boolean);
  const result = {
    id: schedule.id,
    scheduleDate: schedule.schedule_date,
    scheduleType: schedule.schedule_type,
    title: text(schedule.title),
    region: text(schedule.region),
    startTime: text(schedule.start_time),
    endTime: text(schedule.end_time),
    flavors
  };
  // Deliberately no address, note, internal flags, legacy price, or stall price.
  return result;
}

function mapRadishProducts(section) {
  const products = section && section.data && Array.isArray(section.data.products)
    ? section.data.products : [];
  return products.filter(item => item && item.enabled !== false &&
    item.online_enabled === true && finiteMoney(item.price)).map(item => ({
      id: item.id,
      name: text(item.name),
      price: Number(item.price),
      spec: text(item.spec),
      description: text(item.description),
      imageUrl: text(item.image_url)
    }));
}

function mapMerchandise({ products = [], categories = [] } = {}) {
  const activeCategories = new Set(categories.filter(item => item && item.enabled === true)
    .map(item => String(item.id)));
  return products.filter(item => item && item.enabled === true &&
    activeCategories.has(String(item.category_id)) && finiteMoney(item.price)).map(item => ({
      id: item.id,
      categoryId: item.category_id,
      name: text(item.name),
      description: text(item.description),
      price: Number(item.price),
      imageUrl: text(item.image_url),
      sizeOptions: Array.isArray(item.size_options) ? item.size_options.slice() : [],
      productCode: text(item.product_code),
      isNew: item.is_new === true,
      isHot: item.is_hot === true
    }));
}

module.exports = {
  mapDailyMenu,
  mapFlavorCatalog,
  mapMerchandise,
  mapRadishProducts,
  mapSchedule
};
