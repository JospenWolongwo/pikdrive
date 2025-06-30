import * as z from "zod"

// Define form schema for driver documents form
export const formSchema = z.object({
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
  
  // Vehicle images (optional additional photos)
  vehicleImages: z.array(z.string()).optional(),
})
