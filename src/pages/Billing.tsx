
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Coins, Package, Plus, History, CreditCard, Receipt, AlertCircle, CheckCircle } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import ServiceCostDisplay from "@/components/ServiceCostDisplay";
import { CREDIT_PACKAGES, SUBSCRIPTION_PLANS } from "@/constants/pricing";
import { useAuth } from "@/hooks/useAuth";
import { stripeService } from "@/services/api/stripeService";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";

// Initialize Stripe with the correct publishable key
const stripePromise = loadStripe("pk_test_51QRqRsRuznwovkUGZkNOQ4tO7HCmVDEbN0VW0UXnKJj7TrAoXKvKxgcPl3MFLhJbXG6qNqKGlVeAyH1eZH9LGNGM00YRCcBDl7");

interface CheckoutFormProps {
  packageInfo: typeof CREDIT_PACKAGES[0];
  onSuccess: () => void;
  onCancel: () => void;
}

interface PaymentMethodFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Payment Method form component
const PaymentMethodForm = ({ onSuccess, onCancel }: PaymentMethodFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/billing`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || "Failed to save payment method");
        console.error("Payment method error:", error);
      } else {
        toast.success("Payment method added successfully!");
        onSuccess();
      }
    } catch (err) {
      console.error('Error adding payment method:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>{errorMessage}</p>
        </div>
      )}
      
      <PaymentElement />
      
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing}>
          {isProcessing ? "Processing..." : "Save Payment Method"}
        </Button>
      </div>
    </form>
  );
};

// Checkout form component
const CheckoutForm = ({ packageInfo, onSuccess, onCancel }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !user) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Use confirmPayment to complete the payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/billing`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || "Payment failed");
        console.error("Payment error:", error);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Call our backend to update credits
        await stripeService.confirmCreditPurchase(paymentIntent.id);
        toast.success(`Successfully purchased ${packageInfo.credits} credits!`);
        onSuccess();
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>{errorMessage}</p>
        </div>
      )}
      
      <PaymentElement />
      
      <div className="flex items-center justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing}>
          {isProcessing ? "Processing..." : `Pay $${packageInfo.price}`}
        </Button>
      </div>
    </form>
  );
};

const Billing = () => {
  const { user } = useAuth();
  const { credits, addCredits } = useCredits();
  const [activeTab, setActiveTab] = useState("credits");
  const [selectedPackage, setSelectedPackage] = useState<typeof CREDIT_PACKAGES[0] | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<{ clientSecret: string, id: string } | null>(null);
  const [setupIntent, setSetupIntent] = useState<{ clientSecret: string } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);

  // Fetch payment history, subscription data, and payment methods when tab changes
  useEffect(() => {
    if (user) {
      if (activeTab === "history") {
        fetchPaymentHistory();
      } else if (activeTab === "subscription") {
        fetchUserSubscription();
        checkPaymentMethod();
      }
    }
  }, [user, activeTab]);

  const fetchPaymentHistory = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const result = await stripeService.getPaymentHistory(user.id);
      setTransactions(result.transactions || []);
    } catch (err) {
      console.error("Error fetching payment history:", err);
      toast.error("Failed to load payment history");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserSubscription = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const result = await stripeService.getUserSubscription(user.id);
      setUserSubscription(result?.subscription || null);
    } catch (err) {
      console.error("Error fetching subscription:", err);
      toast.error("Failed to load subscription details");
    } finally {
      setIsLoading(false);
    }
  };

  const checkPaymentMethod = async () => {
    if (!user) return;
    
    try {
      const result = await stripeService.checkPaymentMethod(user.id);
      setHasPaymentMethod(result?.hasPaymentMethod || false);
    } catch (err) {
      console.error("Error checking payment method:", err);
    }
  };

  const handleBuyCredits = async (pkg: typeof CREDIT_PACKAGES[0]) => {
    if (!user) {
      toast.error("You must be logged in to purchase credits");
      return;
    }

    // Check if the user has a payment method first
    await checkPaymentMethod();
    
    if (!hasPaymentMethod) {
      toast.error("Please add a payment method before making a purchase", {
        description: "You'll be redirected to add a payment method.",
        action: {
          label: "Add Payment Method",
          onClick: () => handleUpdatePayment(),
        },
      });
      return;
    }

    try {
      setIsLoading(true);
      const result = await stripeService.createPaymentIntent({
        packageId: pkg.id,
        amount: pkg.price,
        credits: pkg.credits,
        userId: user.id
      });
      
      setPaymentIntent({
        clientSecret: result.clientSecret,
        id: result.paymentIntentId
      });
      setSelectedPackage(pkg);
    } catch (err) {
      console.error("Error creating payment intent:", err);
      toast.error("Failed to initiate payment");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePlan = () => {
    // Redirect to subscription change flow or open modal
    toast.info("Subscription change will be implemented in a future update");
  };

  const handleUpdatePayment = async () => {
    if (!user) {
      toast.error("You must be logged in to add a payment method");
      return;
    }

    try {
      setIsLoading(true);
      const result = await stripeService.createSetupIntent(user.id);
      setSetupIntent({
        clientSecret: result.clientSecret
      });
      setIsAddingPaymentMethod(true);
    } catch (err) {
      console.error("Error creating setup intent:", err);
      toast.error("Failed to initiate payment method setup");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentIntent(null);
    setSelectedPackage(null);
    toast.success("Payment successful! Credits have been added to your account.");
    fetchPaymentHistory(); // Refresh history after successful payment
  };

  const handlePaymentMethodSuccess = () => {
    setSetupIntent(null);
    setIsAddingPaymentMethod(false);
    setHasPaymentMethod(true);
    toast.success("Payment method added successfully!");
  };

  const cancelPayment = () => {
    setPaymentIntent(null);
    setSelectedPackage(null);
  };

  const cancelPaymentMethodAddition = () => {
    setSetupIntent(null);
    setIsAddingPaymentMethod(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get the current subscription plan details
  const currentPlan = userSubscription 
    ? SUBSCRIPTION_PLANS.find(plan => plan.id === userSubscription.planId) 
    : SUBSCRIPTION_PLANS[0]; // Default to Starter plan

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Billing & Credits</h1>
          <p className="text-muted-foreground">
            Manage your subscription, purchase credits, and view your billing history
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-100">
          <Coins className="h-5 w-5 text-yellow-500" />
          <span className="font-medium">{credits} credits available</span>
        </div>
      </div>

      <Tabs defaultValue="credits" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            <span>Buy Credits</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Subscription</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span>History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credits" className="space-y-6 mt-6">
          {paymentIntent && selectedPackage ? (
            <Card>
              <CardHeader>
                <CardTitle>Complete Your Purchase</CardTitle>
                <CardDescription>
                  You're purchasing {selectedPackage.credits} credits for ${selectedPackage.price}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret: paymentIntent.clientSecret }}>
                  <CheckoutForm 
                    packageInfo={selectedPackage} 
                    onSuccess={handlePaymentSuccess} 
                    onCancel={cancelPayment}
                  />
                </Elements>
              </CardContent>
            </Card>
          ) : isAddingPaymentMethod && setupIntent ? (
            <Card>
              <CardHeader>
                <CardTitle>Add Payment Method</CardTitle>
                <CardDescription>
                  Add a payment method to make purchases
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret: setupIntent.clientSecret }}>
                  <PaymentMethodForm 
                    onSuccess={handlePaymentMethodSuccess} 
                    onCancel={cancelPaymentMethodAddition}
                  />
                </Elements>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {CREDIT_PACKAGES.map((pkg) => (
                <Card key={pkg.id} className="border border-muted hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-medium">{pkg.name}</CardTitle>
                      <div className="bg-yellow-100 text-yellow-700 font-medium px-2 py-1 rounded text-sm">
                        ${pkg.price}
                      </div>
                    </div>
                    <CardDescription className="text-center">{pkg.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Coins className="h-5 w-5 text-yellow-500 mr-1.5" />
                        <span className="text-2xl font-bold">{pkg.credits}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${(pkg.price / pkg.credits * 100).toFixed(1)}¢ per credit
                      </div>
                    </div>
                    <Button 
                      className="w-full"
                      onClick={() => handleBuyCredits(pkg)}
                      disabled={isLoading}
                    >
                      {isLoading ? "Processing..." : "Purchase Now"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Separator className="my-8" />

          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Service Cost Breakdown</h2>
            <ServiceCostDisplay showSummary={true} />
          </div>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                You are currently on the {currentPlan?.name} plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-lg">{currentPlan?.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentPlan?.price !== null ? `$${currentPlan?.price}/month • ${currentPlan?.creditsPerMonth} credits/month` : 'Custom pricing'}
                  </p>
                </div>
                <Button variant="outline" onClick={handleChangePlan}>Change Plan</Button>
              </div>
              <div className="space-y-4">
                <h4 className="font-medium">Plan Features:</h4>
                <ul className="space-y-2">
                  {currentPlan?.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="bg-green-100 p-1 rounded-full mt-0.5">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Manage your payment details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-md shadow-sm">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    {hasPaymentMethod ? (
                      <>
                        <p className="font-medium">Payment method on file</p>
                        <p className="text-sm text-muted-foreground">Credit card ending in ****</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">No payment method</p>
                        <p className="text-sm text-muted-foreground">Add a payment method to make purchases</p>
                      </>
                    )}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleUpdatePayment}
                  disabled={isLoading}
                >
                  {hasPaymentMethod ? "Update" : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>View your past transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading transaction history...</div>
              ) : transactions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No transaction history yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Description</th>
                        <th className="pb-3 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b">
                          <td className="py-3">{formatDate(tx.created_at)}</td>
                          <td className="py-3 capitalize">{tx.type}</td>
                          <td className="py-3">{tx.description}</td>
                          <td className="py-3">
                            <div className="flex items-center">
                              <Coins className="h-4 w-4 text-yellow-500 mr-1" />
                              <span className={tx.type === 'purchase' ? 'text-green-600' : ''}>
                                {tx.type === 'purchase' ? '+' : '-'}{tx.amount}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Billing;
