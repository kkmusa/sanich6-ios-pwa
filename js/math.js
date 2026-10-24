function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
// Kotlin kotlin.math.round uses ties-to-even, including negative half values.
function androidRound(value) {
  const floor = Math.floor(value);
  return value - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(value);
}
const DngMath = Object.freeze({
  // Head at the requested frequency; passport head is specified at 50 Hz.
  headAtFrequency(headAt50, frequency) {
    if (![headAt50, frequency].every(Number.isFinite) || headAt50 <= 0 || frequency < 0)
      return null;
    return finiteOrNull(headAt50 * (frequency / 50) ** 2);
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
  annularVolume(tubing, casing, wall) {
    if (
      ![tubing, casing, wall].every(Number.isFinite) ||
      tubing <= 0 ||
      casing <= 0 ||
      wall <= 0 ||
      casing - 2 * wall <= tubing
    )
      return null;
    return finiteOrNull((Math.PI / 4) * ((casing - 2 * wall) ** 2 - tubing ** 2) * 1e-6);
  },
  wellFlow(type, delta, vkp, time, vnkt = 0, hst = 0) {
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
    return Number.isFinite(value) ? finiteOrNull(androidRound(value * 100) / 100) : null;
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
  startFrequency(l, h) {
    if (![l, h].every(Number.isFinite) || h <= 0) return null;
    const r = 50 * Math.sqrt((40 * 9.81 + l) / h);
    return Number.isFinite(r) ? r : null;
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
  apvMinimumCycle(q, p, s, dr) {
    return [q, p, s, dr].every(Number.isFinite) && q > 0 && p >= 0 && p < q && s >= 0 && dr >= 0
      ? Math.ceil((s + dr) / (1 - p / q) / 60) * 60
      : null;
  },
});
if (typeof module !== 'undefined' && module.exports) module.exports = DngMath;
