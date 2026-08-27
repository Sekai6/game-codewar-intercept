import type * as THREE from "three";
export interface Covariance6 { positionVariance:number; velocityVariance:number; crossCorrelation?:number; }
export type CecMeasurementSource="ship-radar"|"airborne-radar"|"fire-control-radar"|"passive-cue-confirmed";
export type CecEngagementQuality="cue"|"composite"|"weapon";
export type CecState="off"|"standby"|"active"|"degraded";
export interface CecMeasurement { id:string; sourcePlatformId:string; sourceSensorId:string; targetId:string; observedAt:number; position:THREE.Vector3; velocity:THREE.Vector3; altitude:number; covariance:Covariance6; quality:number; classification:string; timeSyncQuality:number; sourceMode:CecMeasurementSource; }
export interface CecParticipant { id:string; side:"blue"|"red"; position:THREE.Vector3; cecCapable:boolean; alive?:boolean; receiveEnabled:boolean; transmitEnabled:boolean; timeSyncQuality:number; }
export interface CecNetworkConfig { enabled:boolean; maxParticipants?:number; maxRange?:number; baseDelay?:number; reliability?:number; }
export interface CecNetworkMessage { id:string; senderId:string; recipientId:string; measurement:CecMeasurement; queuedAt:number; deliverAt:number; }
export interface CecNetworkResult { delivered:CecNetworkMessage[]; dropped:{message:CecNetworkMessage;reason:string}[]; }
export interface CecCompositeTrack { id:string; targetId:string; contributors:string[]; position:THREE.Vector3; velocity:THREE.Vector3; altitude:number; covariance:Covariance6; quality:number; lastMeasurementAt:number; fusionAge:number; engagementQuality:CecEngagementQuality; weaponSupport:{allowed:boolean;supportingPlatforms:string[];requiredLocalChecks:string[];rejectionReason?:string}; }
export interface CecEngagementSupport { shooterId:string; targetId:string; compositeTrackId:string; authorizedAt:number; expiresAt:number; supportingMeasurements:string[]; localFireControlConfirmed:boolean; midcourseUpdateAllowed:boolean; }
