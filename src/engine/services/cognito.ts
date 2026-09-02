import { defineService } from "../defineService";
import { price } from "../pricing";
import { defined, line, num } from "./util";

export const cognito = defineService({
  id: "cognito",
  term: "Amazon Cognito",
  icon: "aws-cognito",
  role: "ingress",
  settings: {
    monthlyActiveUsers: {
      type: "number",
      min: 0,
      default: 10000,
      label: "Monthly active users",
      driver: true,
    },
    mfa: {
      type: "enum",
      values: ["off", "optional", "required"],
      default: "optional",
      label: "MFA",
      group: "security",
    },
    advancedSecurity: {
      type: "boolean",
      default: false,
      label: "Advanced security",
      description: "Adaptive auth, compromised-credential checks",
      group: "security",
    },
  },
  badge: (s) => `JWT · MFA ${s.mfa === "required" ? "req" : s.mfa === "off" ? "off" : "opt"}${s.advancedSecurity === true ? " · adv" : ""}`,
  cardLines: ["monthlyActiveUsers"],
  cdk: (s, { varName, resourceName }) => {
    const mfa = s.mfa === "required" ? "REQUIRED" : s.mfa === "off" ? "OFF" : "OPTIONAL";
    const second = mfa === "OFF" ? "" : "\n  mfaSecondFactor: { sms: true, otp: true },";
    return `new cognito.UserPool(this, "${varName}", {
  userPoolName: "${resourceName}",
  mfa: cognito.Mfa.${mfa},${second}
});`;
  },
  cfnTypes: ["AWS::Cognito::UserPool"],
  cfn: (s, { resourceName }) => {
    const mfa = s.mfa === "required" ? "ON" : s.mfa === "off" ? "OFF" : "OPTIONAL";
    return [
      {
        Type: "AWS::Cognito::UserPool",
        Properties: {
          UserPoolName: resourceName,
          MfaConfiguration: mfa,
          ...(mfa === "OFF" ? {} : { EnabledMfas: ["SOFTWARE_TOKEN_MFA"] }),
          ...(s.advancedSecurity === true
            ? { UserPoolAddOns: { AdvancedSecurityMode: "ENFORCED" } }
            : {}),
        },
        Metadata: { Overhead: "App clients and the hosted domain are not generated." },
      },
    ];
  },
  fromCfn: (p) => {
    const addOns = p.UserPoolAddOns as { AdvancedSecurityMode?: string } | undefined;
    return defined({
      mfa: p.MfaConfiguration === "ON" ? "required" : p.MfaConfiguration === "OFF" ? "off" : p.MfaConfiguration === "OPTIONAL" ? "optional" : undefined,
      advancedSecurity: addOns ? addOns.AdvancedSecurityMode !== "OFF" : undefined,
    });
  },
  price: (s, _traffic, pricing) => {
    const maus = num(s.monthlyActiveUsers, 10000);
    return [line(price(pricing, "cognito.maus"), maus)];
  },
});
