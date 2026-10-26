import { z } from 'zod';

export const addItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Item name cannot be empty')
    .max(100, 'Item name cannot exceed 100 characters'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99'),
  unitPrice: z
    .number({ invalid_type_error: 'Price must be a number' })
    .min(1, 'Unit price must be at least ₹1')
    .max(25000, 'Unit price cannot exceed ₹25,000'),
  note: z.string().trim().max(150, 'Note cannot exceed 150 characters').optional(),
});

export const updateItemSchema = z.object({
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity cannot exceed 99')
    .optional(),
  unitPrice: z
    .number({ invalid_type_error: 'Price must be a number' })
    .min(1, 'Unit price must be at least ₹1')
    .max(25000, 'Unit price cannot exceed ₹25,000')
    .optional(),
  note: z.string().trim().max(150).optional(),
});
