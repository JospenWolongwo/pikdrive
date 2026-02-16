import * as z from "zod"

// Define form schema for driver documents form
export const formSchema = z.object({
  // Full name as on ID document (required for authenticity)
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be at most 120 characters")
    .refine((val) => !/\d/.test(val), "Name must not contain numbers"),
  // Document files - recto (front) and verso (back) for each document
  // using optional() to allow empty string during form initialization,
  // but we'll validate these separately before form submission
  nationalIdFileRecto: z.string().optional(),
  nationalIdFileVerso: z.string().optional(),
  
  licenseFileRecto: z.string().optional(),
  licenseFileVerso: z.string().optional(),
  
  registrationFileRecto: z.string().optional(),
  registrationFileVerso: z.string().optional(),
  
  insuranceFileRecto: z.string().optional(),
  insuranceFileVerso: z.string().optional(),
  
  // Vehicle images (required - at least one image must be uploaded)
  // Optional in schema, validated separately in form submission
  vehicleImages: z.array(z.string()).optional(),
})
