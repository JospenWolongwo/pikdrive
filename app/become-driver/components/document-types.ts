/**
 * Document field type definitions for the driver application
 */

// Document field name enum for type safety
export enum DocumentFieldName {
  // National ID (CNI)
  NATIONAL_ID_RECTO = "nationalIdFileRecto",
  NATIONAL_ID_VERSO = "nationalIdFileVerso",
  
  // Driver License (Permis)
  LICENSE_RECTO = "licenseFileRecto",
  LICENSE_VERSO = "licenseFileVerso",
  
  // Vehicle Registration (Carte Grise)
  REGISTRATION_RECTO = "registrationFileRecto",
  REGISTRATION_VERSO = "registrationFileVerso",
  
  // Insurance Certificate (Assurance)
  INSURANCE_RECTO = "insuranceFileRecto",
  INSURANCE_VERSO = "insuranceFileVerso",
  
  // Vehicle Images (Array)
  VEHICLE_IMAGES = "vehicleImages"
}

// Document section for organizing UI
export interface DocumentRequirement {
  icon: React.ReactNode;
  title: string;
  items: string[];
}
