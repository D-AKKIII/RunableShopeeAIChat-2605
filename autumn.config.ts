import { feature, plan, item } from "atmn";

export const autoReplies = feature({
  id: "auto_replies",
  name: "自動返信",
  type: "metered",
  consumable: true,
});

export const free = plan({
  id: "free",
  name: "Free",
  autoEnable: true,
  items: [
    item({
      featureId: autoReplies.id,
      included: 20,
      reset: { interval: "month" },
    }),
  ],
});

export const starter = plan({
  id: "starter",
  name: "Starter",
  price: { amount: 2000, interval: "month" }, // $20/month
  items: [
    item({
      featureId: autoReplies.id,
      included: 100,
      reset: { interval: "month" },
    }),
  ],
});

export const pro = plan({
  id: "pro",
  name: "Pro",
  price: { amount: 5500, interval: "month" }, // $55/month
  items: [
    item({
      featureId: autoReplies.id,
      included: 999999,
      reset: { interval: "month" },
    }),
  ],
});

export default {
  features: [autoReplies],
  plans: [free, starter, pro],
};
