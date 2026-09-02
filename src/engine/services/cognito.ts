import { defineService } from "../defineService";
import { price } from "../pricing";
import { line, num } from "./util";

export const cognito = defineService({
  id: "cognito",
  term: "Amazon Cognito",
  icon: "aws-cognito",
  lane: "ingress",
  settings: {
    monthlyActiveUsers: {
      type: "number",
      min: 0,
      default: 10000,
      label: "Monthly active users",
      driver: true,
    },
  },
  cardLines: ["monthlyActiveUsers"],
  price: (s, _traffic, pricing) => {
    const maus = num(s.monthlyActiveUsers, 10000);
    return [line(price(pricing, "cognito.maus"), maus)];
  },
});
