
import { supabase } from "@/integrations/supabase/client";

// Interface for payment intent response
export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

// Interface for credit package purchase
export interface CreditPackagePurchase {
  packageId: string;
  amount: number;
  credits: number;
  userId: string;
}

export const stripeService = {
  // Create a payment intent for purchasing credits
  createPaymentIntent: async (purchase: CreditPackagePurchase): Promise<PaymentIntentResponse> => {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { 
          purchase 
        }
      });
      
      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },
  
  // Confirm a credit purchase after successful payment
  confirmCreditPurchase: async (paymentIntentId: string): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke('confirm-credit-purchase', {
        body: { 
          paymentIntentId 
        }
      });
      
      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      console.error('Error confirming credit purchase:', error);
      throw error;
    }
  },
  
  // Get user subscription details
  getUserSubscription: async (userId: string): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-user-subscription', {
        body: { 
          userId 
        }
      });
      
      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  },
  
  // Get user payment history
  getPaymentHistory: async (userId: string): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-payment-history', {
        body: { 
          userId 
        }
      });
      
      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }
};
