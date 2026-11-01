import { Addon } from '../models/Addon';
import { Banner } from '../models/Banner';
import { Category } from '../models/Category';
import { Country } from '../models/Country';
import { Cuisine } from '../models/Cuisine';
import { Coupon } from '../models/Coupon';
import { Food } from '../models/Food';
import { Restaurant } from '../models/Restaurant';
import { SubCategory } from '../models/SubCategory';
import { User } from '../models/User';
import { Zone } from '../models/Zone';
import { hashPassword } from '../utils/crypto';
import { bootstrapDatabase } from './bootstrap';

const demoPassword = () => process.env.SEED_USER_PASSWORD || 'password123';

const ensureUser = async (name: string, email: string, role: 'USER' | 'VENDOR' | 'RIDER') => {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({
    name,
    email,
    password: await hashPassword(demoPassword()),
    role,
    phone: role === 'USER' ? '+15555550100' : undefined,
    phoneVerified: role === 'USER',
    phoneIsVerified: role === 'USER',
    emailVerified: true,
    emailIsVerified: true,
  });
};

export const seedDemoData = async () => {
  await bootstrapDatabase();
  const [customer, rider, owner] = await Promise.all([
    ensureUser('Postal Test Customer', 'customer@postal.local', 'USER'),
    ensureUser('Postal Test Rider', 'rider@postal.local', 'RIDER'),
    ensureUser('Postal Demo Owner', 'vendor@postal.local', 'VENDOR'),
  ]);
  const polygon = [[
    [31.51, 30.3683], [31.61, 30.3683], [31.61, 30.4683], [31.51, 30.4683], [31.51, 30.3683],
  ]];
  const zone = await Zone.findOneAndUpdate(
    { title: 'Postal Demo Zone' },
    { $setOnInsert: { description: 'Demo delivery zone', tax: 0, location: { type: 'Polygon', coordinates: polygon }, isActive: true } },
    { upsert: true, new: true }
  );
  await rider.updateOne({ $set: { zone: zone._id, location: { type: 'Point', coordinates: [31.5600, 30.4183] } } });
  const cuisine = await Cuisine.findOneAndUpdate(
    { name: 'Postal Demo Cuisine' },
    { $setOnInsert: { description: 'Demo dishes', image: 'https://example.com/images/postal-cuisine.png', shopType: 'restaurant', isActive: true } },
    { upsert: true, new: true }
  );
  const restaurant = await Restaurant.findOneAndUpdate(
    { slug: 'postal-demo-restaurant' },
    {
      $setOnInsert: {
        name: 'Postal Demo Restaurant',
        orderId: 'POSTAL-DEMO',
        orderPrefix: 'PD',
        image: 'https://example.com/images/postal-restaurant.png',
        logo: 'https://example.com/images/postal-logo.png',
        address: 'Demo address, New York',
        location: { type: 'Point', coordinates: [31.5600, 30.4183] },
        deliveryBounds: { type: 'Polygon', coordinates: polygon },
        deliveryTime: 30,
        minimumOrder: 1,
        salesTax: 0,
        owner: owner._id,
        zone: zone._id,
        shopType: 'restaurant',
        cuisines: [cuisine.name],
        sections: ['Featured'],
        keywords: ['demo', 'postal'],
        tags: ['demo'],
        freeDelivery: false,
        acceptVouchers: true,
        isActive: true,
        isAvailable: true,
      },
    },
    { upsert: true, new: true }
  );
  const category = await Category.findOneAndUpdate(
    { title: 'Postal Demo Mains' },
    { $setOnInsert: { description: 'Demo main dishes', image: 'https://example.com/images/postal-category.png', restaurant: restaurant._id, isActive: true } },
    { upsert: true, new: true }
  );
  await Restaurant.findByIdAndUpdate(restaurant._id, { $addToSet: { categories: category._id } });
  const subCategory = await SubCategory.findOneAndUpdate(
    { title: 'Postal Demo Bowls', parentCategoryId: category._id.toString() },
    { $setOnInsert: { isActive: true } },
    { upsert: true, new: true }
  );
  const addon = await Addon.findOneAndUpdate(
    { title: 'Postal Demo Extras' },
    {
      $setOnInsert: {
        description: 'Optional extras',
        quantityMinimum: 0,
        quantityMaximum: 2,
        options: [
          { title: 'Extra sauce', description: 'Demo sauce', price: 0.5 },
          { title: 'Extra vegetables', description: 'Demo vegetables', price: 1 },
        ],
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  const food = await Food.findOne({ title: 'Postal Demo Bowl', restaurant: restaurant._id });
  const demoFood = food || await Food.create({
    title: 'Postal Demo Bowl',
    description: 'A database-seeded demo meal',
    image: 'https://example.com/images/postal-bowl.png',
    subCategory: subCategory._id.toString(),
    restaurant: restaurant._id,
    category: category._id,
    isPopular: true,
    isActive: true,
    isAvailable: true,
    variations: [
      { title: 'Regular', price: 10, discounted: 0, addons: [addon._id] },
      { title: 'Large', price: 14, discounted: 12, addons: [addon._id] },
    ],
  });
  await Food.findOneAndUpdate(
    { title: 'Postal Demo Juice', restaurant: restaurant._id },
    {
      $setOnInsert: {
        description: 'A database-seeded demo drink',
        image: 'https://example.com/images/postal-juice.png',
        restaurant: restaurant._id,
        category: category._id,
        isActive: true,
        isAvailable: true,
        variations: [{ title: 'Regular', price: 4, discounted: 0, addons: [] }],
      },
    },
    { upsert: true }
  );
  await Banner.findOneAndUpdate(
    { title: 'Postal Demo Banner' },
    { $setOnInsert: { description: 'Demo banner', action: 'navigate', screen: 'Restaurant', file: 'https://example.com/images/postal-banner.png', parameters: { restaurantId: restaurant._id.toString() }, isActive: true } },
    { upsert: true }
  );
  await Coupon.findOneAndUpdate(
    { code: 'POSTAL10' },
    { $setOnInsert: { title: 'POSTAL10', discount: 10, restaurant: restaurant._id, isActive: true, isEnabled: true } },
    { upsert: true }
  );
  await Country.findOneAndUpdate(
    { iso: 'US' },
    { $setOnInsert: { cities: [{ id: 'nyc', name: 'New York', latitude: 30.4183, longitude: 31.5600 }] } },
    { upsert: true }
  );
  return { customer, rider, owner, zone, restaurant, category, addon, food: demoFood };
};
