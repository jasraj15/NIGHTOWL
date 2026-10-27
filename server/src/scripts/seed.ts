import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Pool } from '../models/Pool.js';
import { PoolItem } from '../models/PoolItem.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { Notification } from '../models/Notification.js';
import { PaymentEvent } from '../models/PaymentEvent.js';
import { calculateProportionalCostSplit } from '../services/costSplitService.js';

async function seed() {
  console.log('🌱 Starting NightOwl [DEMO ONLY] Database Seeder...');
  await mongoose.connect(env.MONGODB_URI);

  // Clean existing demo collections
  await Promise.all([
    User.deleteMany({}),
    Pool.deleteMany({}),
    PoolItem.deleteMany({}),
    PaymentRecord.deleteMany({}),
    AuditEvent.deleteMany({}),
    Notification.deleteMany({}),
    PaymentEvent.deleteMany({}),
  ]);

  console.log('🧹 Cleaned existing database collections.');

  // Create demo verified college users
  const userArjun = await User.create({
    fullName: 'Arjun Mehta [DEMO]',
    email: 'arjun.demo@sst.scaler.com',
    phoneNumber: '9876543210',
    hostel: 'Uniworld 1',
    roomNumber: 'Tower A - 304',
    isEmailVerified: true,
    hostelSelected: true,
    role: 'student',
  });

  const userPriya = await User.create({
    fullName: 'Priya Sharma [DEMO]',
    email: 'priya.demo@sst.scaler.com',
    phoneNumber: '9812345678',
    hostel: 'Uniworld 1',
    roomNumber: 'Tower B - 212',
    isEmailVerified: true,
    hostelSelected: true,
    role: 'student',
  });

  const userRohit = await User.create({
    fullName: 'Rohit Verma [DEMO]',
    email: 'rohit.demo@sst.scaler.com',
    phoneNumber: '9988776655',
    hostel: 'Uniworld 2',
    roomNumber: 'Wing 1 - 405',
    isEmailVerified: true,
    hostelSelected: true,
    role: 'student',
  });

  const userAnanya = await User.create({
    fullName: 'Ananya Rao [DEMO]',
    email: 'ananya.demo@sst.scaler.com',
    phoneNumber: '9765432109',
    hostel: 'Uniworld 2',
    roomNumber: 'Wing 2 - 110',
    isEmailVerified: true,
    hostelSelected: true,
    role: 'student',
  });

  console.log('👤 Created 4 demo students across Uniworld 1 and Uniworld 2.');

  // Pool 1: Uniworld 1 - Blinkit - OPEN
  const closingIn30 = new Date(Date.now() + 45 * 60 * 1000);
  const pool1 = await Pool.create({
    title: 'Midnight Maggi & Energy Drinks Sprint 🍜',
    retailer: 'Blinkit',
    hostel: 'Uniworld 1',
    deliveryZone: 'Tower A Ground Lobby',
    targetAmount: 500,
    contributionCap: 300,
    participantLimit: 6,
    closingTime: closingIn30,
    notes: 'Ordering right at 12:15 AM! Add items quickly.',
    creator: userArjun._id,
    status: 'OPEN',
    participants: [userArjun._id, userPriya._id],
    currentSubtotal: 0,
  });

  // Items for Pool 1
  const item1 = await PoolItem.create({
    poolId: pool1._id,
    userId: userArjun._id,
    name: 'Maggi 2-Minute Noodles (Pack of 4)',
    quantity: 2,
    unitPrice: 56,
    itemSubtotal: 112,
    note: 'Special masala if available',
  });

  const item2 = await PoolItem.create({
    poolId: pool1._id,
    userId: userArjun._id,
    name: 'Red Bull Energy Drink (250ml)',
    quantity: 1,
    unitPrice: 125,
    itemSubtotal: 125,
  });

  const item3 = await PoolItem.create({
    poolId: pool1._id,
    userId: userPriya._id,
    name: 'Doritos Sweet Chilli Nachos (Large)',
    quantity: 2,
    unitPrice: 50,
    itemSubtotal: 100,
  });

  pool1.currentSubtotal = 112 + 125 + 100;
  await pool1.save();

  await AuditEvent.create({
    poolId: pool1._id,
    userId: userArjun._id,
    action: 'POOL_CREATED',
    details: { title: pool1.title, targetAmount: 500 },
  });

  // Pool 2: Uniworld 1 - Zepto - LOCKED
  const pool2 = await Pool.create({
    title: 'Zepto Ice Cream & Waffles Midnight Cravings 🍦',
    retailer: 'Zepto',
    hostel: 'Uniworld 1',
    deliveryZone: 'Main Gate Security Desk',
    targetAmount: 400,
    participantLimit: 5,
    closingTime: new Date(Date.now() + 10 * 60 * 1000),
    notes: 'Locked! Host is currently placing the cart on Zepto.',
    creator: userPriya._id,
    status: 'LOCKED',
    lockedAt: new Date(Date.now() - 3 * 60 * 1000),
    participants: [userPriya._id, userArjun._id],
    currentSubtotal: 420,
  });

  await PoolItem.create({
    poolId: pool2._id,
    userId: userPriya._id,
    name: 'Amul Belgian Chocolate Tub (500ml)',
    quantity: 1,
    unitPrice: 220,
    itemSubtotal: 220,
  });

  await PoolItem.create({
    poolId: pool2._id,
    userId: userArjun._id,
    name: 'Kwality Walls Cornetto Double Chocolate',
    quantity: 4,
    unitPrice: 50,
    itemSubtotal: 200,
  });

  await PaymentRecord.create({
    poolId: pool2._id,
    userId: userPriya._id,
    itemSubtotal: 220,
    allocatedFee: 0,
    totalDue: 220,
    paymentStatus: 'PENDING',
  });

  await PaymentRecord.create({
    poolId: pool2._id,
    userId: userArjun._id,
    itemSubtotal: 200,
    allocatedFee: 0,
    totalDue: 200,
    paymentStatus: 'PENDING',
  });

  // Pool 3: Uniworld 2 - Flipkart Minutes - ORDERED
  const pool3 = await Pool.create({
    title: 'Exam Night Cold Brew & Sandwich Fix ☕🥪',
    retailer: 'Flipkart Minutes',
    hostel: 'Uniworld 2',
    deliveryZone: 'Wing 1 Common Study Room',
    targetAmount: 350,
    participantLimit: 4,
    closingTime: new Date(Date.now() - 15 * 60 * 1000),
    notes: 'Order placed! Estimated arrival in 12 mins. Pay via UPI.',
    creator: userRohit._id,
    status: 'ORDERED',
    lockedAt: new Date(Date.now() - 12 * 60 * 1000),
    participants: [userRohit._id, userAnanya._id],
    currentSubtotal: 380,
    finalPayableAmount: 410,
    deliveryFee: 15,
    otherCharges: 15, // platform fee
    upiId: 'rohitverma@okaxis',
    paymentInstructions: 'Send ₹ to rohitverma@okaxis and paste UTR below.',
    orderPlacedAt: new Date(Date.now() - 5 * 60 * 1000),
  });

  await PoolItem.create({
    poolId: pool3._id,
    userId: userRohit._id,
    name: 'Sleepy Owl Cold Brew Hazelnut',
    quantity: 2,
    unitPrice: 110,
    itemSubtotal: 220,
  });

  await PoolItem.create({
    poolId: pool3._id,
    userId: userAnanya._id,
    name: 'Veg Club Sandwich (Pack of 2)',
    quantity: 1,
    unitPrice: 160,
    itemSubtotal: 160,
  });

  // Calculate proportional split for pool3
  const split3 = calculateProportionalCostSplit(
    [
      { userId: userRohit._id.toString(), itemSubtotal: 220 },
      { userId: userAnanya._id.toString(), itemSubtotal: 160 },
    ],
    15,
    15,
    410
  );

  for (const s of split3.splits) {
    const isOwner = s.userId === userRohit._id.toString();
    await PaymentRecord.create({
      poolId: pool3._id,
      userId: s.userId,
      itemSubtotal: s.itemSubtotal,
      allocatedFee: s.allocatedFee,
      totalDue: s.totalDue,
      paymentStatus: isOwner ? 'PAID' : 'PROCESSING',
      paymentMethod: 'MANUAL_UPI',
      paidAt: isOwner ? new Date(Date.now() - 2 * 60 * 1000) : undefined,
      paymentReference: isOwner ? 'OWNER_PAID_BILL' : 'UPI/409823194821',
      submittedAt: new Date(Date.now() - 3 * 60 * 1000),
      reviewedAt: isOwner ? new Date(Date.now() - 2 * 60 * 1000) : undefined,
    });
  }

  console.log('✅ Demo pools created with realistic items, proportional splits, and status lifecycles.');
  console.log(`\nDemo Credentials for Testing:`);
  console.log(`- Arjun (Uniworld 1): arjun.demo@sst.scaler.com`);
  console.log(`- Priya (Uniworld 1): priya.demo@sst.scaler.com`);
  console.log(`- Rohit (Uniworld 2): rohit.demo@sst.scaler.com`);
  console.log(`- Ananya (Uniworld 2): ananya.demo@sst.scaler.com`);
  console.log(`\n(Use the Login page with any of these emails to receive a login OTP in the server console/logs!)\n`);

  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
