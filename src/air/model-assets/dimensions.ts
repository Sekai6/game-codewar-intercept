import { metersToModel } from "./model-kit.js";

export interface AircraftReferenceDimensions {
  realLengthMeters: number;
  realWingspanMeters: number;
  realHeightMeters: number;
  modelLength: number;
  modelWingspan: number;
  modelHeight: number;
}

function dimensions(
  realLengthMeters: number,
  realWingspanMeters: number,
  realHeightMeters: number,
): AircraftReferenceDimensions {
  return {
    realLengthMeters,
    realWingspanMeters,
    realHeightMeters,
    modelLength: metersToModel(realLengthMeters),
    modelWingspan: metersToModel(realWingspanMeters),
    modelHeight: metersToModel(realHeightMeters),
  };
}

export const AIRCRAFT_REFERENCE_DIMENSIONS = {
  F14A: {
    ...dimensions(19.13, 19.55, 4.88),
    sweptWingspanMeters: 11.65,
    sweptModelWingspan: metersToModel(11.65),
  },
  A6E: dimensions(16.69, 16.15, 4.93),
  MIG29A: dimensions(17.32, 11.36, 4.73),
  TU16K: dimensions(34.8, 33, 10.36),
  E2C: {
    ...dimensions(17.6, 24.56, 5.58),
    rotodomeDiameterMeters: 7.315,
    modelRotodomeDiameter: metersToModel(7.315),
    propellerDiameterMeters: 4.11,
    modelPropellerDiameter: metersToModel(4.11),
  },
  TU126: {
    ...dimensions(57.3, 51.1, 15.5),
    airframeLengthMeters: 54.1,
    modelAirframeLength: metersToModel(54.1),
    refuelingProbeLengthMeters: 3.2,
    modelRefuelingProbeLength: metersToModel(3.2),
    rotodomeDiameterMeters: 11,
    modelRotodomeDiameter: metersToModel(11),
    rotodomeThicknessMeters: 2,
    modelRotodomeThickness: metersToModel(2),
    rotodomeSupportHeightMeters: 2.6,
    modelRotodomeSupportHeight: metersToModel(2.6),
    propellerDiameterMeters: 5.6,
    modelPropellerDiameter: metersToModel(5.6),
  },
} as const;
