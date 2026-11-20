function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

const PERIODIC_LEVEL_DROP_RATES = [20, 30, 35, 50, 80, 125, 160, 200, 250, 400, 500];
const PERIODIC_LEVEL_DROP_10_MIN = {
  '139.7': {
    60: [15, 23, 27, 38, 61, 95, 122, 153, 191, 305, 382],
    73: [14, 21, 24, 35, 56, 87, 111, 139, 174, 278, 347],
    89: [24, 36, 42, 60, 96, 150, 192, 239, 299, 479, 599],
  },
  146: {
    60: [14, 21, 24, 35, 56, 87, 111, 139, 174, 278, 347],
    73: [16, 24, 28, 40, 64, 100, 128, 160, 200, 319, 399],
    89: [21, 31, 36, 52, 83, 130, 166, 207, 259, 415, 518],
  },
  168: {
    60: [9, 14, 16, 23, 37, 58, 74, 93, 116, 185, 231],
    73: [10, 15, 18, 26, 41, 64, 82, 102, 128, 204, 255],
    89: [12, 18, 21, 30, 49, 76, 97, 122, 152, 244, 305],
  },
  178: {
    60: [8, 12, 14, 21, 33, 52, 66, 83, 103, 165, 207],
    73: [9, 13, 16, 22, 36, 56, 72, 90, 112, 179, 224],
    89: [10, 16, 18, 26, 41, 65, 83, 104, 130, 207, 259],
  },
};
// Kotlin kotlin.math.round uses ties-to-even, including negative half values.
function androidRound(value) {
  const floor = Math.floor(value);
  return value - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(value);
}

// Multiphase pressure model for the MRM dynamic-level calculation.
// The names below intentionally stay local: the public entry point is mrmDynamicLevel.
function mrmBubblepoint(rsb, gasDensity, temperatureK, oilDensity) {
  const original = rsb,
    limited = Math.min(800, Math.max(1.8, rsb)),
    api = 141.5 / oilDensity - 131.5,
    logRs = Math.log(limited),
    z1 = -4.814074834 + 0.7480913 * logRs + 0.1743556 * logRs ** 2 - 0.0206 * logRs ** 3,
    z2 = 1.27 - 0.0449 * api + 4.36e-4 * api ** 2 - 4.76e-6 * api ** 3,
    z3 = 4.51 - 10.84 * gasDensity + 8.39 * gasDensity ** 2 - 2.34 * gasDensity ** 3,
    z4 =
      -7.2254661 +
      0.043155 * temperatureK -
      8.5548e-5 * temperatureK ** 2 +
      6.00696e-8 * temperatureK ** 3;
  let result = Math.exp(2.498006 + 0.713 * (z1 + z2 + z3 + z4) + 0.0075 * (z1 + z2 + z3 + z4) ** 2);
  if (original < 1.8) result = ((result - 0.1013) * original) / 1.8 + 0.1013;
  if (original > 800) result = ((result - 0.1013) * original) / 800 + 0.1013;
  return result;
}

function mrmGasOilRatio(pressure, bubblepoint, gasDensity, temperatureK, oilDensity, rsb) {
  const api = 141.5 / oilDensity - 131.5;
  if (bubblepoint > mrmBubblepoint(800, gasDensity, temperatureK, oilDensity))
    return pressure < bubblepoint ? rsb * (pressure / bubblepoint) : rsb;
  const reduced = bubblepoint > 0 ? (pressure - 0.101) / bubblepoint : 0;
  if (reduced <= 0) return 0;
  if (reduced >= 1) return rsb;
  const fahrenheit = 1.8 * temperatureK - 460,
    a1 = 1.8653e-4 * gasDensity ** 1.672608 * api ** 0.92987 * fahrenheit ** 0.247235 * bubblepoint ** 1.056052,
    a2 = 0.1004 * gasDensity ** -1.00475 * api ** 0.337711 * fahrenheit ** 0.132795 * bubblepoint ** 0.302065,
    a3 = 0.9167 * gasDensity ** -1.48548 * api ** -0.164741 * fahrenheit ** -0.09133 * bubblepoint ** 0.047094;
  return (a1 * reduced ** a2 + (1 - a1) * reduced ** a3) * rsb;
}

function mrmOilCompressibility(rs, gasDensity, temperatureK, oilDensity, pressureMpa) {
  return (
    (28.1 * rs + 30.6 * temperatureK - 1180 * gasDensity + 1784 / oilDensity - 10910) /
    (100000 * pressureMpa)
  );
}

function mrmOilDensity(pressure, gasDensity, temperatureK, oilDensity, rs, bubblepoint, compressibility) {
  if (rs > 800) {
    rs = 800;
    bubblepoint = mrmBubblepoint(rs, gasDensity, temperatureK, oilDensity);
  }
  let density = 845.8 - 0.9 * rs,
    previous = 0;
  for (let i = 0; i < 1000 && Math.abs(previous - density) > 1e-6; i++) {
    previous = density;
    const gasDensityAtPressure =
      -799.21 +
      1361.8 * gasDensity -
      3.70373 * gasDensity * density +
      0.003 * gasDensity * density ** 2 +
      2.98914 * density -
      0.00223 * density ** 2;
    density =
      (rs * gasDensity + 818.81 * oilDensity) /
      (0.81881 + (rs * gasDensity) / gasDensityAtPressure);
  }
  const pressureForDensity = Math.min(pressure, bubblepoint),
    pressureCorrection =
      (0.167 + 16.181 * 10 ** (-0.00265 * density)) * (2.32328 * pressureForDensity) -
      0.16 *
        (0.299 + 263 * 10 ** (-0.00376 * density)) *
        (0.14503774 * pressureForDensity) ** 2,
    saturatedDensity = density + pressureCorrection,
    temperatureBase = 1.8 * temperatureK - 520,
    power1 = temperatureK < 293 ? 1 : 0.938,
    power2 = temperatureK < 293 ? 1 : 0.475,
    temperatureCorrection =
      (0.04837 + 337.094 * saturatedDensity ** -0.951) * temperatureBase ** power1 -
      (0.346 - 0.3732 * 10 ** (-0.001 * saturatedDensity)) * temperatureBase ** power2,
    atBubblepoint = saturatedDensity - temperatureCorrection;
  return pressure <= bubblepoint
    ? atBubblepoint
    : atBubblepoint * Math.exp(compressibility * (pressure - bubblepoint));
}

function mrmHighGasProperties(gasFactor, temperatureC, oilDensity, bubblepointAtm, oilFvf) {
  const rs = gasFactor * oilDensity;
  if (rs <= 200)
    return { bubblepoint: bubblepointAtm, oilFvf, corrected: false };
  const gasDensity = 0.8,
    temperatureK = temperatureC + 273,
    calculatedBubblepointMpa = mrmBubblepoint(rs, gasDensity, temperatureK, oilDensity),
    calculatedBubblepointAtm = calculatedBubblepointMpa / 0.1013,
    pressureMpa = bubblepointAtm * 0.1013,
    dissolvedGas = mrmGasOilRatio(
      pressureMpa,
      calculatedBubblepointMpa,
      gasDensity,
      temperatureK,
      oilDensity,
      rs,
    ),
    compressibility = mrmOilCompressibility(
      rs,
      gasDensity,
      temperatureK,
      oilDensity,
      pressureMpa,
    );
  let calculatedFvf;
  if (pressureMpa > calculatedBubblepointMpa) {
    const densityAtBubblepoint = mrmOilDensity(
        calculatedBubblepointMpa,
        gasDensity,
        temperatureK,
        oilDensity,
        rs,
        calculatedBubblepointMpa,
        compressibility,
      ),
      saturatedFvf = (oilDensity * 1000 + 1.22117 * rs * gasDensity) / densityAtBubblepoint;
    calculatedFvf =
      saturatedFvf * Math.exp(compressibility * (calculatedBubblepointMpa - pressureMpa));
  } else {
    const density = mrmOilDensity(
      pressureMpa,
      gasDensity,
      temperatureK,
      oilDensity,
      dissolvedGas,
      calculatedBubblepointMpa,
      compressibility,
    );
    calculatedFvf = (oilDensity * 1000 + 1.22117 * dissolvedGas * gasDensity) / density;
  }
  return {
    bubblepoint:
      Math.abs((calculatedBubblepointAtm - bubblepointAtm) / calculatedBubblepointAtm) < 0.2
        ? bubblepointAtm
        : calculatedBubblepointAtm,
    oilFvf:
      Math.abs((calculatedFvf - oilFvf) / calculatedFvf) < 0.2 ? oilFvf : calculatedFvf,
    corrected: true,
  };
}

function mrmLogDensity(vg, distribution, oilFvf, pressure1, pressure2, standardPressure) {
  const a = oilFvf - standardPressure,
    b = 1 - oilFvf,
    c = (distribution - 1) * vg,
    e = distribution * vg;
  if (oilFvf > 1) {
    if (Math.abs(vg) < 1e-15)
      return (
        (Math.log(a + b * pressure1) - Math.log(a + b * pressure2)) /
        b *
        oilFvf *
        (1 - standardPressure)
      );
    const numerator =
      -Math.log(a + b * pressure2) * a +
      Math.log(a + b * pressure2) * e * b -
      Math.log(c + pressure2) * e * b +
      Math.log(c + pressure2) * c * b +
      Math.log(a + b * pressure1) * a -
      Math.log(a + b * pressure1) * e * b +
      Math.log(c + pressure1) * e * b -
      Math.log(c + pressure1) * c * b;
    return (numerator / (-a + b * c) / b) * oilFvf * (1 - standardPressure);
  }
  if (Math.abs(vg) < 1e-15) return pressure2 - pressure1;
  return pressure2 - pressure1 + Math.log((c + pressure2) / (c + pressure1)) * (e - c);
}

function mrmGasLiquidColumn(pinD, annulusD, gasVelocity, oilFvf, standardPressure) {
  if (pinD >= 1) {
    if (annulusD < 1 && oilFvf > 1)
      return (
        oilFvf * (pinD - 1) +
        (oilFvf * (1 - standardPressure)) /
          (oilFvf - 1) *
          Math.log(
            (oilFvf - standardPressure - annulusD * (oilFvf - 1)) /
              (1 - standardPressure),
          )
      );
    return oilFvf * (pinD - annulusD);
  }
  const gasShare = 1 - pinD,
    transitionStart = (gasVelocity / 0.188) * gasShare,
    bubbleStart = (gasVelocity / 0.057) * gasShare,
    transitionDistribution = 1.2 + (0.44 - 0.2) / (0.188 - 0.057),
    transitionVelocity = (0.2 * 0.188 - 0.44 * 0.057) / (0.188 - 0.057),
    regimes = [
      [0, transitionStart, 1.2, (gasVelocity / 0.44) * gasShare],
      [transitionStart, bubbleStart, transitionDistribution, (gasVelocity / transitionVelocity) * gasShare],
      [bubbleStart, Infinity, 1.2, (gasVelocity / 0.2) * gasShare],
    ];
  let result = 0;
  for (const [lower, upper, distribution, velocity] of regimes) {
    const pressure1 = Math.max(annulusD, lower),
      pressure2 = Math.min(pinD, upper);
    if (pressure1 < pressure2)
      result += mrmLogDensity(
        velocity,
        distribution,
        oilFvf,
        pressure1,
        pressure2,
        standardPressure,
      );
  }
  return result;
}
const DngMath = Object.freeze({
  // Head at the requested frequency; passport head is specified at 50 Hz.
  headAtFrequency(headAt50, frequency) {
    if (![headAt50, frequency].every(Number.isFinite) || headAt50 <= 0 || frequency < 0)
      return null;
    return finiteOrNull(headAt50 * (frequency / 50) ** 2);
  },
  mrmDynamicLevel({
    intakePressure,
    annulusPressure,
    oilDensity,
    pumpDepth,
    perforationDepth,
    perforationExtension,
    casingInnerDiameter,
    liquidRate,
    watercut,
    bubblepointPressure,
    gasFactor,
    oilFvf,
    separationCoefficient,
    tubingOuterDiameter,
    reservoirTemperature,
  }) {
    const values = [
      intakePressure,
      annulusPressure,
      oilDensity,
      pumpDepth,
      perforationDepth,
      perforationExtension,
      casingInnerDiameter,
      liquidRate,
      watercut,
      bubblepointPressure,
      gasFactor,
      oilFvf,
      separationCoefficient,
      tubingOuterDiameter,
      reservoirTemperature,
    ];
    if (
      !values.every(Number.isFinite) ||
      intakePressure <= 0 ||
      annulusPressure < 0 ||
      annulusPressure >= intakePressure ||
      oilDensity <= 0 ||
      pumpDepth <= 0 ||
      perforationDepth < pumpDepth ||
      perforationExtension < 0 ||
      perforationExtension >= perforationDepth ||
      casingInnerDiameter <= tubingOuterDiameter ||
      tubingOuterDiameter <= 0 ||
      liquidRate < 0 ||
      watercut < 0 ||
      watercut > 100 ||
      bubblepointPressure <= 0 ||
      gasFactor < 0 ||
      oilFvf <= 0 ||
      separationCoefficient < 0 ||
      separationCoefficient > 1 ||
      reservoirTemperature <= -273
    )
      return null;
    const pumpExtension = (pumpDepth / perforationDepth) * perforationExtension,
      correction = 1 - pumpExtension / pumpDepth,
      verticalPumpDepth = pumpDepth - pumpExtension,
      properties = mrmHighGasProperties(
        gasFactor,
        reservoirTemperature,
        oilDensity,
        bubblepointPressure,
        oilFvf,
      ),
      meanAnnulusTemperature = 0.8 * (reservoirTemperature + 273) + 0.2 * 303,
      oilRate = liquidRate * (1 - watercut / 100),
      gasOilRatio = gasFactor * oilDensity,
      annularArea =
        3.1415 *
        ((casingInnerDiameter / 2000) ** 2 - (tubingOuterDiameter / 2000) ** 2),
      areaCoefficient = annularArea * (303 / meanAnnulusTemperature) / 0.9 / (1 / 86400),
      gasVelocity =
        (oilRate * gasOilRatio * separationCoefficient) /
        areaCoefficient /
        properties.bubblepoint,
      pinD = intakePressure / properties.bubblepoint,
      annulusD = annulusPressure / properties.bubblepoint,
      standardPressure = 1 / properties.bubblepoint,
      scale = (properties.bubblepoint / oilDensity / 9.81) * 100,
      dimensionlessColumn = mrmGasLiquidColumn(
        pinD,
        annulusD,
        gasVelocity,
        properties.oilFvf,
        standardPressure,
      ),
      fluidColumn = scale * dimensionlessColumn,
      level = (verticalPumpDepth - fluidColumn) / correction;
    if (
      ![
        pumpExtension,
        correction,
        verticalPumpDepth,
        meanAnnulusTemperature,
        annularArea,
        gasVelocity,
        scale,
        dimensionlessColumn,
        fluidColumn,
        level,
        properties.bubblepoint,
        properties.oilFvf,
      ].every(Number.isFinite) ||
      correction <= 0 ||
      annularArea <= 0 ||
      dimensionlessColumn < 0 ||
      level < 0 ||
      level > pumpDepth
    )
      return null;
    return {
      level,
      fluidColumn,
      pumpExtension,
      verticalPumpDepth,
      bubblepointUsed: properties.bubblepoint,
      oilFvfUsed: properties.oilFvf,
      highGasCorrection: properties.corrected,
    };
  },
  casingInnerDiameter(casing, wall) {
    if (![casing, wall].every(Number.isFinite) || casing <= 0 || wall <= 0) return null;
    return casing - 2 * wall > 0 ? casing - 2 * wall : null;
  },
  sensorHermetic(depth, pressure1, pressure2, annulus, density, casing, tubing, vkp, time) {
    if (
      ![depth, pressure1, pressure2, annulus, density].every(Number.isFinite) ||
      density <= 0 ||
      typeof casing !== 'string' ||
      typeof tubing !== 'string' ||
      !casing.trim() ||
      !tubing.trim()
    )
      return null;
    const level1 = depth - ((pressure1 - annulus) * 10) / density,
      level2 = depth - ((pressure2 - annulus) * 10) / density;
    return DngMath.wellFlow('hermetic', Math.abs(level1 - level2), vkp, time);
  },
  operatorRamp(start, end, delta, seconds) {
    if (
      ![start, end, delta, seconds].every(Number.isFinite) ||
      start <= 0 ||
      end <= start ||
      delta <= 0 ||
      seconds <= 0
    )
      return null;
    const totalSeconds = ((end - start) / delta) * seconds,
      rate = (delta * 3600) / seconds,
      roundedMinutes = Math.round(totalSeconds / 60);
    return [totalSeconds, rate].every(Number.isFinite) && Number.isSafeInteger(roundedMinutes)
      ? {
          start,
          end,
          delta,
          seconds,
          rate,
          totalMinutes: totalSeconds / 60,
          duration:
            String(Math.floor(roundedMinutes / 60)).padStart(2, '0') +
            ':' +
            String(roundedMinutes % 60).padStart(2, '0'),
        }
      : null;
  },
  operatorRich(high, low, highMinutes, lowMinutes) {
    if (
      ![high, low, highMinutes, lowMinutes].every(Number.isFinite) ||
      high <= low ||
      low <= 0 ||
      highMinutes <= 0 ||
      lowMinutes <= 0
    )
      return null;
    const underloadSeconds = (lowMinutes + 1) * 60;
    return Number.isFinite(underloadSeconds)
      ? { high, low, highMinutes, lowMinutes, underloadSeconds }
      : null;
  },
  intervalBetweenDates(startDate, startHour, startMinute, endDate, endHour, endMinute) {
    const validTime = (h, m) =>
      Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
    const day = (value) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const date = new Date(value + 'T00:00:00Z');
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
        ? date.getTime()
        : null;
    };
    const start = day(startDate),
      end = day(endDate);
    if (
      start === null ||
      end === null ||
      !validTime(startHour, startMinute) ||
      !validTime(endHour, endMinute)
    )
      return null;
    // Calendar-time difference matches Android LocalDateTime/ChronoUnit arithmetic.
    const minutes = (end - start) / 60000 + endHour * 60 + endMinute - startHour * 60 - startMinute;
    return minutes > 0 ? minutes : null;
  },
  annularVolume(tubing, casing, wall, cableArea = 0) {
    if (
      ![tubing, casing, wall, cableArea].every(Number.isFinite) ||
      cableArea < 0 ||
      tubing <= 0 ||
      casing <= 0 ||
      wall <= 0 ||
      casing - 2 * wall <= tubing
    )
      return null;
    const area = (Math.PI / 4) * ((casing - 2 * wall) ** 2 - tubing ** 2) - cableArea;
    return area > 0 ? finiteOrNull(area * 1e-6) : null;
  },
  wellFlowRaw(type, delta, vkp, time, vnkt = 0, hst = 0) {
    if (
      ![delta, vkp, time, vnkt, hst].every(Number.isFinite) ||
      delta < 0 ||
      vkp < 0 ||
      time <= 0 ||
      vnkt < 0 ||
      hst < 0
    )
      return null;
    let value;
    if (type === 'hermetic') value = (delta * vkp * 1440) / time;
    else if (type === 'drain') value = ((delta * vkp - vnkt * hst) * 1440) / time;
    else if (type === 'afterDrain') value = (delta * (vkp + vnkt) * 1440) / time;
    else return null;
    return finiteOrNull(value);
  },
  wellFlow(type, delta, vkp, time, vnkt = 0, hst = 0) {
    const value = DngMath.wellFlowRaw(type, delta, vkp, time, vnkt, hst);
    return value === null ? null : finiteOrNull(androidRound(value * 100) / 100);
  },
  skoVolume(variant, depth, tubingLiters = null, casingInner = null, tubingOuter = null) {
    if (!Number.isFinite(depth) || depth <= 0) return null;
    let base,
      additional = 0;
    if (variant === 'direct' || variant === 'direct8') {
      if (!Number.isFinite(tubingLiters) || tubingLiters <= 0) return null;
      base = (tubingLiters * depth) / 1000;
      additional = variant === 'direct8' ? 8 : 0;
    } else if (variant === 'reverse' || variant === 'reverseOff') {
      if (!Number.isFinite(casingInner) || casingInner <= 0) return null;
      if (variant === 'reverse') {
        if (!Number.isFinite(tubingOuter) || tubingOuter <= 0 || casingInner <= tubingOuter)
          return null;
        base = 0.79 * depth * (casingInner * casingInner - tubingOuter * tubingOuter);
        additional = 0.5;
      } else base = 0.79 * casingInner * casingInner * depth;
    } else return null;
    return Number.isFinite(base + additional)
      ? { base, additional, total: base + additional }
      : null;
  },
  tapVoltage({
    mode,
    input,
    supply,
    motorVoltage,
    current,
    length,
    section,
    temperature,
    material = 'cu',
    motor = 'async',
    vfdVoltage = null,
    maxFrequency = null,
    nominalFrequency = null,
    filter = false,
  }) {
    if (
      ![input, supply, motorVoltage, current, length, section, temperature].every(
        Number.isFinite,
      ) ||
      [input, supply, motorVoltage, current, length, section].some((v) => v <= 0) ||
      !['cu', 'al'].includes(material) ||
      !['async', 'pm'].includes(motor)
    )
      return null;
    const temperatureCoefficient = 1 + 0.0043 * (temperature - 20);
    if (temperatureCoefficient <= 0) return null;
    const loss =
      Math.sqrt(3) *
      current *
      (motor === 'async' ? 0.85 : 0.95) *
      (length / section) *
      (material === 'cu' ? 0.017 : 0.026) *
      temperatureCoefficient;
    let base;
    if (mode === 'no') base = (input / supply) * motorVoltage;
    else if (mode === 'vfd') {
      if (
        ![vfdVoltage, maxFrequency, nominalFrequency].every(Number.isFinite) ||
        [vfdVoltage, maxFrequency, nominalFrequency].some((v) => v <= 0)
      )
        return null;
      base =
        (input / vfdVoltage) *
        (maxFrequency / nominalFrequency) *
        motorVoltage *
        (filter ? 1.08 : 1);
    } else return null;
    return Number.isFinite(base + loss)
      ? { temperatureCoefficient, loss, total: base + loss }
      : null;
  },
  pedNominalFlow(casing, wall, diameter, speed) {
    if (![casing, wall, diameter, speed].every(Number.isFinite) ||
        casing <= 0 || wall <= 0 || diameter <= 0 || speed <= 0 ||
        casing - 2 * wall <= diameter) return null;
    const flow = Math.PI / 4 * (((casing - 2 * wall) / 1000) ** 2 -
      (diameter / 1000) ** 2) * speed * 86400;
    return Number.isFinite(flow) && flow > 0 ? flow : null;
  },
  pedCooling(nominalFlow, workingCurrent, nominalCurrent) {
    if (
      ![nominalFlow, workingCurrent, nominalCurrent].every(Number.isFinite) ||
      nominalFlow < 0 ||
      workingCurrent < 0 ||
      nominalCurrent <= 0
    )
      return null;
    const flow =
      nominalFlow * (workingCurrent / nominalCurrent) * (workingCurrent / nominalCurrent);
    return Number.isFinite(flow) ? flow : null;
  },
  // Android part01: MotorCoefficientScreen.kt, lines 35–46.
  motorCoefficient(rpm, poles, frequency = null, reverse = false) {
    if (
      !Number.isFinite(rpm) ||
      rpm <= 0 ||
      !Number.isInteger(poles) ||
      poles <= 0 ||
      poles % 2 !== 0
    )
      return null;
    const base = (rpm * (poles / 2)) / 60,
      coefficient = base / 50;
    if (!Number.isFinite(coefficient) || coefficient <= 0) return null;
    const converted =
      Number.isFinite(frequency) && frequency >= 0
        ? reverse
          ? frequency / coefficient
          : frequency * coefficient
        : null;
    return { base, coefficient, converted: Number.isFinite(converted) ? converted : null };
  },
  // Android part01: EngineeringToolsScreens.kt, TemperatureSetpointScreen.
  temperatureSetpoint(working, group) {
    const maximum = { Д1: 120, Д2: 150, Д3: 170 }[group];
    return Number.isFinite(working) && working >= 0 && maximum !== undefined
      ? Math.min(working * 1.05, maximum * 0.85)
      : null;
  },
  // Android part01: EngineeringToolsScreens.kt, WellPotentialScreen.
  wellPotential(q, on, off, delay = 0) {
    if (
      ![q, on, off, delay].every(Number.isFinite) ||
      q < 0 ||
      on <= 0 ||
      off < 0 ||
      delay < 0 ||
      delay >= on
    )
      return null;
    const result = (q * (on - delay)) / (on + off);
    return Number.isFinite(result) ? result : null;
  },
  liquidLevel(d, z, p, rho) {
    if (![d, z, p, rho].every(Number.isFinite) || rho <= 0) return null;
    const value = d - ((p - z) * 10) / (rho / 1000);
    return Number.isFinite(value) ? finiteOrNull(androidRound(value * 100) / 100) : null;
  },
  measuredDepthFromInclinometry(verticalLevel, vertical1, measured1, vertical2, measured2) {
    if (![verticalLevel, vertical1, measured1, vertical2, measured2].every(Number.isFinite))
      return null;
    if ([verticalLevel, vertical1, measured1, vertical2, measured2].some((value) => value < 0))
      return null;
    if (vertical1 > vertical2) {
      [vertical1, vertical2] = [vertical2, vertical1];
      [measured1, measured2] = [measured2, measured1];
    }
    if (
      vertical2 <= vertical1 ||
      measured2 <= measured1 ||
      measured1 < vertical1 ||
      measured2 < vertical2 ||
      verticalLevel < vertical1 ||
      verticalLevel > vertical2
    )
      return null;
    const result =
      measured1 +
      ((verticalLevel - vertical1) * (measured2 - measured1)) / (vertical2 - vertical1);
    return Number.isFinite(result) ? finiteOrNull(androidRound(result * 100) / 100) : null;
  },
  startFrequency(l, h) {
    if (![l, h].every(Number.isFinite) || h <= 0) return null;
    const r = 50 * Math.sqrt((40 * 9.81 + l) / h);
    return Number.isFinite(r) ? r : null;
  },
  foreignPumpFlow(rateBpd, baseFrequency = 60, targetFrequency = 50) {
    if (
      ![rateBpd, baseFrequency, targetFrequency].every(Number.isFinite) ||
      rateBpd <= 0 ||
      baseFrequency <= 0 ||
      targetFrequency <= 0
    )
      return null;
    const barrelsPerDay = rateBpd * (targetFrequency / baseFrequency);
    const cubicMetersPerDay = barrelsPerDay * 0.158987294928;
    return [barrelsPerDay, cubicMetersPerDay].every(Number.isFinite)
      ? { barrelsPerDay, cubicMetersPerDay }
      : null;
  },
  intervalMinutes(startDay, startHour, startMinute, endHour, endMinute) {
    const values = [startDay, startHour, startMinute, endHour, endMinute];
    if (
      !values.every(Number.isInteger) ||
      ![0, 1].includes(startDay) ||
      startHour < 0 ||
      startHour > 23 ||
      endHour < 0 ||
      endHour > 23 ||
      startMinute < 0 ||
      startMinute > 59 ||
      endMinute < 0 ||
      endMinute > 59
    )
      return null;
    const duration =
      1440 * (1 - startDay) + endHour * 60 + endMinute - (startHour * 60 + startMinute);
    return duration > 0 && duration <= 2880 ? duration : null;
  },
  manualDebitInterval(liters, minutes) {
    return [liters, minutes].every(Number.isFinite) && liters > 0 && minutes > 0
      ? finiteOrNull((liters * 1.44) / minutes)
      : null;
  },
  manualDebit(l, s) {
    return [l, s].every(Number.isFinite) && l > 0 && s > 0 ? finiteOrNull((l * 86.4) / s) : null;
  },
  operatingCycle(q, p, s, c) {
    if (![q, p, s, c].every(Number.isFinite) || q <= 0 || p < 0 || s < 0 || c <= 0) return null;
    const productive = (c * p) / q,
      total = productive + s;
    return total < c ? { productive, total, stop: c - total } : null;
  },
  // Round one duration and derive the other so a whole-minute cycle stays unchanged.
  roundOperatingTimes(total, cycle) {
    if (
      !Number.isFinite(total) ||
      !Number.isSafeInteger(cycle) ||
      cycle <= 0 ||
      total < 0 ||
      total >= cycle
    )
      return null;
    const rounded = Math.round(total),
      stop = cycle - rounded;
    if ((total > 0 && rounded === 0) || stop <= 0) return null;
    return { total: rounded, stop };
  },
  // All operating-cycle times are minutes, as in Android OperatingModeCalculator.
  apvCycle(q, p, s, dr, c) {
    if (
      ![q, p, s, dr, c].every(Number.isFinite) ||
      q <= 0 ||
      p < 0 ||
      p >= q ||
      s < 0 ||
      dr < 0 ||
      c <= 0
    )
      return null;
    const productive = (c * p) / q,
      total = productive + s,
      stop = c - total,
      required = (s + dr) / (1 - p / q),
      minimum = Math.ceil(required / 60) * 60;
    if (![productive, total, stop, required, minimum].every(Number.isFinite)) return null;
    return { productive, total, stop, required, minimum, suitable: c >= minimum && stop >= dr };
  },
  rpd(D, d, rhoOil, rhoWater, watercut, inflow, pump, intake, run, maxAccum) {
    if (
      ![D, d, rhoOil, rhoWater, watercut, inflow, pump, intake, run, maxAccum].every(
        Number.isFinite,
      ) ||
      D <= d ||
      d <= 0 ||
      rhoOil <= 0 ||
      rhoWater <= 0 ||
      watercut < 0 ||
      watercut > 100 ||
      inflow <= 0 ||
      pump <= inflow ||
      intake <= 0 ||
      run <= 0 ||
      maxAccum <= 0
    )
      return null;
    const initialVolume = ((pump - inflow) / 1440) * run,
      initialAccum = (initialVolume * 1440) / inflow,
      actualRun = initialAccum > maxAccum ? (run * maxAccum) / initialAccum : run;
    if (![initialVolume, initialAccum, actualRun].every(Number.isFinite) ||
        initialVolume <= 0 || initialAccum <= 0 || actualRun <= 0) return null;
    const volume = ((pump - inflow) / 1440) * actualRun,
      accumulation = (volume * 1440) / inflow,
      area = (Math.PI / 4) * (D * D - d * d),
      deltaLevel = volume / area,
      rho = rhoOil * (1 - watercut / 100) + (rhoWater * watercut) / 100,
      deltaP = (deltaLevel * rho * 9.81) / 101300,
      off = intake - deltaP;
    return [actualRun, volume, accumulation, deltaLevel, rho, deltaP, off].every(Number.isFinite)
      ? { actualRun, volume, accumulation, deltaLevel, rho, deltaP, off, start: intake }
      : null;
  },
  rpdCycle({
    casingDiameter,
    tubingDiameter,
    oilDensity,
    waterDensity,
    watercut,
    inflow,
    pumpRate,
    intakePressure,
    unitPower,
    cycleTime,
    maxAccumulationTime,
  }) {
    const values = [
      casingDiameter,
      tubingDiameter,
      oilDensity,
      waterDensity,
      watercut,
      inflow,
      pumpRate,
      intakePressure,
      unitPower,
      cycleTime,
      maxAccumulationTime,
    ];
    if (
      !values.every(Number.isFinite) ||
      casingDiameter <= tubingDiameter ||
      tubingDiameter <= 0 ||
      oilDensity <= 0 ||
      waterDensity <= 0 ||
      watercut < 0 ||
      watercut > 100 ||
      inflow <= 0 ||
      pumpRate <= inflow ||
      intakePressure <= 0 ||
      unitPower <= 0 ||
      cycleTime <= 0 ||
      maxAccumulationTime <= 0
    )
      return null;
    const runTime = (inflow / pumpRate) * cycleTime,
      volume = ((pumpRate - inflow) / 1440) * runTime,
      accumulationTime = (volume * 1440) / inflow,
      adjustedRunTime =
        accumulationTime > maxAccumulationTime
          ? (runTime * maxAccumulationTime) / accumulationTime
          : runTime,
      adjustedAccumulationTime =
        accumulationTime < maxAccumulationTime
          ? ((((pumpRate - inflow) / 1440) * adjustedRunTime) * 1440) / inflow
          : (adjustedRunTime * accumulationTime) / runTime,
      area = (3.14 / 4) * ((casingDiameter / 1000) ** 2 - (tubingDiameter / 1000) ** 2),
      deltaLevel = volume / area,
      mixtureDensity =
        (oilDensity * 1000 * (100 - watercut) + waterDensity * 1000 * watercut) / 100,
      deltaPressure = (deltaLevel * mixtureDensity * 9.81) / 101300,
      adjustedDeltaPressure = deltaPressure * (adjustedAccumulationTime / accumulationTime),
      offPressure = intakePressure - adjustedDeltaPressure,
      averagePower =
        (unitPower * (adjustedRunTime - (0.75 * 7) / 60)) /
        (adjustedRunTime + adjustedAccumulationTime);
    if (
      ![
        runTime,
        volume,
        accumulationTime,
        adjustedRunTime,
        adjustedAccumulationTime,
        area,
        deltaLevel,
        mixtureDensity,
        deltaPressure,
        adjustedDeltaPressure,
        offPressure,
        averagePower,
      ].every(Number.isFinite) ||
      adjustedRunTime <= 0 ||
      adjustedAccumulationTime <= 0 ||
      offPressure < 0 ||
      averagePower < 0
    )
      return null;
    return {
      runTime,
      accumulationTime,
      adjustedRunTime,
      adjustedAccumulationTime,
      volume,
      deltaLevel,
      mixtureDensity,
      deltaPressure,
      adjustedDeltaPressure,
      offPressure,
      startPressure: intakePressure,
      averagePower,
    };
  },
  periodicProgramCorrection(elapsedDays, levelDifference, loweringSpeed, accumulation, run) {
    if (
      ![elapsedDays, levelDifference, loweringSpeed, accumulation, run].every(Number.isFinite) ||
      elapsedDays <= 0 ||
      levelDifference <= 0 ||
      loweringSpeed <= 0 ||
      accumulation <= 0 ||
      run <= 0
    )
      return null;
    const elapsedMinutes = elapsedDays * 24 * 60,
      cycle = accumulation + run,
      cycles = elapsedMinutes / cycle,
      levelPerCycle = levelDifference / cycles,
      runIncrease = levelPerCycle / (loweringSpeed / 60),
      correctedRun = run + runIncrease;
    return [elapsedMinutes, cycle, cycles, levelPerCycle, runIncrease, correctedRun].every(
      Number.isFinite,
    )
      ? { elapsedMinutes, cycle, cycles, levelPerCycle, runIncrease, correctedRun }
      : null;
  },
  periodicLevelDrop(casingDiameter, nominalRate, tubingDiameter) {
    if (![casingDiameter, nominalRate, tubingDiameter].every(Number.isFinite)) return null;
    const rateIndex = PERIODIC_LEVEL_DROP_RATES.indexOf(nominalRate),
      perTenMinutes = PERIODIC_LEVEL_DROP_10_MIN[String(casingDiameter)]?.[tubingDiameter]?.[rateIndex];
    return rateIndex >= 0 && Number.isFinite(perTenMinutes)
      ? { perTenMinutes, perHour: perTenMinutes * 6 }
      : null;
  },
  energyConsumption({
    tapVoltage,
    workingCurrent,
    powerFactor,
    controlOutputVoltage,
    networkVoltage,
    workingHoursPerDay,
    dailyLiquidRate,
    daysInMonth,
  }) {
    const values = [
      tapVoltage,
      workingCurrent,
      powerFactor,
      controlOutputVoltage,
      networkVoltage,
      workingHoursPerDay,
      dailyLiquidRate,
      daysInMonth,
    ];
    if (
      !values.every(Number.isFinite) ||
      tapVoltage <= 0 ||
      workingCurrent <= 0 ||
      powerFactor <= 0 ||
      powerFactor > 1 ||
      controlOutputVoltage <= 0 ||
      networkVoltage <= 0 ||
      workingHoursPerDay <= 0 ||
      workingHoursPerDay > 24 ||
      dailyLiquidRate <= 0 ||
      !Number.isInteger(daysInMonth) ||
      daysInMonth < 1 ||
      daysInMonth > 31
    )
      return null;
    const activePower =
        (Math.sqrt(3) *
          tapVoltage *
          workingCurrent *
          powerFactor *
          controlOutputVoltage) /
        networkVoltage /
        1000,
      specificEnergy = (activePower * workingHoursPerDay) / dailyLiquidRate,
      monthlyEnergy = activePower * workingHoursPerDay * daysInMonth;
    return [activePower, specificEnergy, monthlyEnergy].every(Number.isFinite)
      ? { activePower, specificEnergy, monthlyEnergy }
      : null;
  },
  cablePowerLoss(length, section, ambientTemperature, workingCurrent, economicCurrentDensity) {
    if (
      ![length, section, ambientTemperature, workingCurrent, economicCurrentDensity].every(
        Number.isFinite,
      ) ||
      length <= 0 ||
      section <= 0 ||
      ambientTemperature <= -273 ||
      workingCurrent <= 0 ||
      economicCurrentDensity <= 0
    )
      return null;
    const resistanceAt20 = (0.01875 * length) / section,
      conductorTemperature = workingCurrent * 0.79 + ambientTemperature,
      resistance = resistanceAt20 * (1 + 0.0043 * (conductorTemperature - 20)),
      powerLoss = (3 * workingCurrent ** 2 * resistance) / 1000,
      requiredSection = workingCurrent / economicCurrentDensity,
      standardSection = [10, 13, 16, 25, 35].find((value) => requiredSection <= value) ?? null;
    return [resistanceAt20, conductorTemperature, resistance, powerLoss, requiredSection].every(
      Number.isFinite,
    ) && resistance > 0
      ? {
          resistanceAt20,
          conductorTemperature,
          resistance,
          powerLoss,
          requiredSection,
          standardSection,
        }
      : null;
  },
  optimalTubingDiameter(liquidRate, pumpDepth, casingInnerDiameter) {
    if (
      ![liquidRate, pumpDepth, casingInnerDiameter].every(Number.isFinite) ||
      liquidRate < 0 ||
      pumpDepth <= 0 ||
      casingInnerDiameter <= 0
    )
      return null;
    if (liquidRate < 120 && pumpDepth < 1800) return 60;
    if (liquidRate > 450 && casingInnerDiameter >= 132) return 89;
    return 73;
  },
  pumpFillCoefficient(dailyLiquidRate, workingHours, nominalRate, liquidFvf) {
    if (
      ![dailyLiquidRate, workingHours, nominalRate, liquidFvf].every(Number.isFinite) ||
      dailyLiquidRate < 0 ||
      workingHours <= 0 ||
      workingHours > 24 ||
      nominalRate <= 0 ||
      liquidFvf <= 0
    )
      return null;
    const coefficient =
      (dailyLiquidRate / workingHours / (nominalRate / 24)) * liquidFvf;
    return Number.isFinite(coefficient)
      ? {
          coefficient,
          status: coefficient < 0.7 || coefficient > 1.3 ? 'Требуется корректировка' : 'Оптимально',
        }
      : null;
  },
  pumpDepthReduction({
    liquidRate,
    pumpDepth,
    pumpExtension,
    levelExtension,
    gasFactor,
    hasGasSeparator,
    oilFvf,
    bubblepointPressure,
    oilDensity,
    annulusPressure,
    dynamicLevel,
  }) {
    const values = [
      liquidRate,
      pumpDepth,
      pumpExtension,
      levelExtension,
      gasFactor,
      oilFvf,
      bubblepointPressure,
      oilDensity,
      annulusPressure,
      dynamicLevel,
    ];
    if (
      !values.every(Number.isFinite) ||
      liquidRate < 0 ||
      pumpDepth <= 0 ||
      pumpExtension < 0 ||
      pumpExtension >= pumpDepth ||
      levelExtension < 0 ||
      gasFactor < 0 ||
      typeof hasGasSeparator !== 'boolean' ||
      oilFvf <= 0 ||
      bubblepointPressure <= 0 ||
      oilDensity <= 0 ||
      annulusPressure < 0 ||
      dynamicLevel < 0
    )
      return null;
    const rateCoefficient = liquidRate < 80 ? 0.8 : 0.4,
      separatorCoefficient = hasGasSeparator ? 0.5 : 0,
      gasCoefficient =
        0.25 / ((1 - rateCoefficient) * (1 - separatorCoefficient)),
      criterionDepth =
        pumpDepth -
        pumpExtension +
        levelExtension -
        ((gasFactor - gasCoefficient * oilFvf) * bubblepointPressure) /
          (gasCoefficient * bubblepointPressure * oilFvf + gasFactor) /
          (oilDensity * 9.81 * 1e-2) +
        annulusPressure / (9.81 * oilDensity * 10 ** -1.5),
      canReduce =
        (criterionDepth > pumpDepth && pumpDepth - 500 > dynamicLevel) ||
        criterionDepth - 500 > dynamicLevel;
    return [gasCoefficient, criterionDepth].every(Number.isFinite)
      ? {
          gasCoefficient,
          criterionDepth,
          reserveAfterReduction: criterionDepth - 500 - dynamicLevel,
          canReduce,
        }
      : null;
  },
  twoAParameters({
    pumpRpm,
    polePairs,
    targetEquivalentFrequency,
    currentEquivalentFrequency,
    nominalHead,
    nominalRate,
  }) {
    if (
      ![
        pumpRpm,
        polePairs,
        targetEquivalentFrequency,
        currentEquivalentFrequency,
        nominalHead,
        nominalRate,
      ].every(Number.isFinite) ||
      pumpRpm <= 0 ||
      !Number.isInteger(polePairs) ||
      polePairs <= 0 ||
      targetEquivalentFrequency < 0 ||
      currentEquivalentFrequency < 0 ||
      nominalHead <= 0 ||
      nominalRate < 0
    )
      return null;
    const shaftFrequency = pumpRpm / 60,
      nominalStationFrequency = shaftFrequency * polePairs,
      targetRatio = targetEquivalentFrequency / 50,
      currentRatio = currentEquivalentFrequency / 50,
      targetStationFrequency = targetRatio * nominalStationFrequency,
      currentStationFrequency = currentRatio * nominalStationFrequency,
      targetHead = nominalHead * targetRatio ** 2,
      currentHead = nominalHead * currentRatio ** 2,
      targetRate = nominalRate * targetRatio,
      currentRate = nominalRate * currentRatio;
    return [
      shaftFrequency,
      nominalStationFrequency,
      targetStationFrequency,
      currentStationFrequency,
      targetHead,
      currentHead,
      targetRate,
      currentRate,
    ].every(Number.isFinite)
      ? {
          shaftFrequency,
          nominalStationFrequency,
          targetStationFrequency,
          currentStationFrequency,
          targetEquivalentFrequency,
          currentEquivalentFrequency,
          targetHead,
          currentHead,
          targetRate,
          currentRate,
          exceedsLimit: targetStationFrequency > 200 || currentStationFrequency > 200,
        }
      : null;
  },
  apvMinimumCycle(q, p, s, dr) {
    return [q, p, s, dr].every(Number.isFinite) && q > 0 && p >= 0 && p < q && s >= 0 && dr >= 0
      ? Math.ceil((s + dr) / (1 - p / q) / 60) * 60
      : null;
  },
});
if (typeof module !== 'undefined' && module.exports) module.exports = DngMath;
