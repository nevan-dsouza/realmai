
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.2.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    // Get the Stripe secret key from environment variables
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) {
      console.error("Missing STRIPE_SECRET_KEY environment variable");
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { userId } = await req.json();
    
    if (!userId) {
      console.error("Missing user ID in request");
      return new Response(
        JSON.stringify({ error: "Missing user ID" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`Creating setup intent for user: ${userId}`);

    // Create a reliable customer ID format
    const customerId = `cus_${userId.replace(/-/g, '')}`;
    
    try {
      // Check if the customer exists
      const customer = await stripe.customers.retrieve(customerId);
      console.log(`Found existing customer: ${customerId}`);
      
      if (customer.deleted) {
        console.log(`Customer ${customerId} was deleted, creating a new one`);
        const newCustomer = await stripe.customers.create({
          id: customerId,
          metadata: { userId }
        });
        console.log(`Created new customer: ${newCustomer.id}`);
      }
    } catch (error) {
      // Customer doesn't exist, create it
      console.log(`Customer ${customerId} not found, creating a new one`);
      try {
        const customer = await stripe.customers.create({
          id: customerId,
          metadata: { userId }
        });
        console.log(`Created new customer: ${customer.id}`);
      } catch (createError) {
        console.error(`Error creating customer: ${createError.message}`);
        throw createError;
      }
    }

    // Create a setup intent for the customer
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: "off_session",
        metadata: {
          userId: userId,
        },
      });

      console.log(`Successfully created setup intent ${setupIntent.id} for customer: ${customerId}`);
      console.log(`Setup intent created: ${JSON.stringify({
        clientSecret: setupIntent.client_secret
      })}`);

      return new Response(
        JSON.stringify({
          clientSecret: setupIntent.client_secret,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (setupError) {
      console.error(`Error creating setup intent: ${setupError.message}`);
      throw setupError;
    }
  } catch (error) {
    console.error(`Error in create-setup-intent: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stackTrace: error.stack
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
