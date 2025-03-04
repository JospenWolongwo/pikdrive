const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

async function generateApiUser(subscriptionKey) {
  const apiUserId = uuidv4();
  
  console.log('🔑 Generating API User...');
  console.log(`API User ID (MOMO_COLLECTION_USER_ID): ${apiUserId}`);
  console.log('Making request to:', `${SANDBOX_BASE_URL}/v1_0/apiuser`);
  
  try {
    const headers = {
      'X-Reference-Id': apiUserId,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json'
    };

    console.log('Request headers:', headers);

    const response = await fetch(`${SANDBOX_BASE_URL}/v1_0/apiuser`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        providerCallbackHost: process.env.MOMO_CALLBACK_HOST || 'https://pikdrive.com'
      })
    });

    console.log('Response status:', response.status);
    const responseHeaders = response.headers.raw();
    console.log('Response headers:', responseHeaders);

    if (!response.ok) {
      const text = await response.text();
      console.log('Error response body:', text);
      throw new Error(`Failed to create API user: ${response.statusText}`);
    }

    // Check if API user was created
    const checkResponse = await fetch(`${SANDBOX_BASE_URL}/v1_0/apiuser/${apiUserId}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey
      }
    });

    if (!checkResponse.ok) {
      throw new Error('Failed to verify API user creation');
    }

    return apiUserId;
  } catch (error) {
    console.error('Detailed error:', error);
    throw error;
  }
}

async function generateApiKey(subscriptionKey, apiUserId) {
  console.log('🔐 Generating API Key...');
  console.log('Making request to:', `${SANDBOX_BASE_URL}/v1_0/apiuser/${apiUserId}/apikey`);

  try {
    const headers = {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json'
    };

    console.log('Request headers:', headers);

    const response = await fetch(
      `${SANDBOX_BASE_URL}/v1_0/apiuser/${apiUserId}/apikey`,
      {
        method: 'POST',
        headers
      }
    );

    console.log('Response status:', response.status);
    const responseHeaders = response.headers.raw();
    console.log('Response headers:', responseHeaders);

    if (!response.ok) {
      const text = await response.text();
      console.log('Error response body:', text);
      throw new Error(`Failed to generate API key: ${response.statusText}`);
    }

    const { apiKey } = await response.json();
    console.log(`API Key (MOMO_API_KEY): ${apiKey}`);
    return apiKey;
  } catch (error) {
    console.error('Detailed error:', error);
    throw error;
  }
}

async function main() {
  try {
    // We'll use the Collection Primary Key for these operations
    const subscriptionKey = process.env.MOMO_COLLECTION_PRIMARY_KEY;
    
    if (!subscriptionKey) {
      console.error('❌ Error: MOMO_COLLECTION_PRIMARY_KEY not found in .env file');
      console.log('Please add your Collection Primary Key to .env file first');
      process.exit(1);
    }

    console.log('🚀 Starting MTN MOMO credential generation...');
    console.log('Using Collection Primary Key:', subscriptionKey.substring(0, 8) + '...');
    
    // Generate API User
    const apiUserId = await generateApiUser(subscriptionKey);
    
    // Generate API Key
    const apiKey = await generateApiKey(subscriptionKey, apiUserId);

    console.log('\n✅ Success! Add these to your .env file:');
    console.log(`MOMO_COLLECTION_USER_ID=${apiUserId}`);
    console.log(`MOMO_API_KEY=${apiKey}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
