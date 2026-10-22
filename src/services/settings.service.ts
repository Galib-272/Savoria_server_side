import { RestaurantSettings } from '../models/Settings.model.js';

/** Returns the single settings document, creating it with defaults on first use. */
export const getRestaurantSettings = async () => {
  let settings = await RestaurantSettings.findOne();
  if (!settings) settings = await RestaurantSettings.create({});
  return settings;
};
