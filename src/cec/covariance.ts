import type { Covariance6 } from "./types.js";

const clamp = (v:number, lo:number, hi:number) => Math.min(hi, Math.max(lo, v));
export function diagonalCovariance(positionVariance:number, velocityVariance:number, correlation=0): Covariance6 { return { positionVariance, velocityVariance, crossCorrelation: correlation }; }
export function covarianceTrace(c:Covariance6):number { return c.positionVariance*3+c.velocityVariance*3; }
export function covarianceInflate(c:Covariance6, factor:number):Covariance6 {
  const f=Math.max(1,factor); return { positionVariance:c.positionVariance*f, velocityVariance:c.velocityVariance*f, crossCorrelation:(c.crossCorrelation??0)*f };
}
export function covarianceFuse(a:Covariance6,b:Covariance6, weightA:number, weightB:number):Covariance6 {
  const wa=Math.max(0,weightA), wb=Math.max(0,weightB), s=wa+wb||1;
  return { positionVariance:(a.positionVariance*wa+b.positionVariance*wb)/s, velocityVariance:(a.velocityVariance*wa+b.velocityVariance*wb)/s, crossCorrelation:((a.crossCorrelation??0)*wa+(b.crossCorrelation??0)*wb)/s };
}
export function covarianceQuality(c:Covariance6, maxTrace:number):number { return clamp(1-covarianceTrace(c)/Math.max(1,maxTrace),0,1); }
