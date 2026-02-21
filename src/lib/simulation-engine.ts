// Company Simulation Engine — closed-loop 30-day simulation with doc gates, denial modeling, and delay cascades

export interface CompanyProfile {
  // Dispatch
  tripsPerDayPerTruck: number;
  truckCount: number;
  dialysisPercent: number; // 0-100
  avgLoadedMiles: number;
  crewPerTruck: number;
  shiftHours: number;
  latePatientPercent: number; // 0-100
  noShowPercent: number; // 0-100

  // Documentation
  pcsObtainedWhen: string;
  whoCollectsSignatures: string;
  whenTimesEntered: string;
  whoVerifiesCharts: string;
  commonMissingDocs: string[];

  // Billing
  whoBuildsClaimsRole: string;
  claimBuildFrequency: "daily" | "weekly" | "biweekly";
  avgPaymentDays: number;
  denialPercent: number; // 0-100
  topDenialReasons: string[];

  // Financial
  revenuePerTrip: number;
  currentBillingDelayDays: number;
  currentARDays: number;
}

export interface DaySimulation {
  day: number;
  date: string;
  totalTrips: number;
  dialysisTrips: number;
  dischargeTrips: number;
  completedTrips: number;
  noShows: number;
  latePatients: number;
  facilityDelays: number;
  patientNotReady: number;
  cleanClaims: number;
  blockedClaims: number;
  reviewClaims: number;
  revenueGenerated: number;
  revenueBlocked: number;
  missingDocs: number;
  dispatchBottlenecks: number;
  cascadeDelays: number;
  // doc gate breakdown
  missingTimestamps: number;
  missingMiles: number;
  missingSignatures: number;
  missingPCS: number;
  missingNecessity: number;
}

export interface DenialBreakdown {
  category: string;
  count: number;
  revenue: number;
}

export interface SimulationResult {
  days: DaySimulation[];
  summary: {
    totalTrips: number;
    totalCompleted: number;
    totalNoShows: number;
    totalLatePatients: number;
    totalFacilityDelays: number;
    totalPatientNotReady: number;
    totalCleanClaims: number;
    totalBlockedClaims: number;
    totalReviewClaims: number;
    cleanClaimPercent: number;
    totalRevenueGenerated: number;
    totalRevenueBlocked: number;
    totalRevenueDelayed: number;
    totalMissingDocs: number;
    totalDispatchBottlenecks: number;
    totalCascadeDelays: number;
    arAging: { bucket: string; amount: number }[];
    avgDaysToPayment: number;
    denialBreakdown: DenialBreakdown[];
    operationalFailures: string[];
    dispatchBottleneckDetails: string[];
    docFailureDetails: string[];
    // Financial closed-loop
    dispatchEfficiency: number;
    revenueCapturedWithPodDispatch: number;
    revenueBlockedWithPodDispatch: number;
    improvementDelta: number;
  };
  stressVerdict: {
    overall: "green" | "yellow" | "red";
    areas: { area: string; verdict: "green" | "yellow" | "red"; detail: string }[];
  };
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function runSimulation(profile: CompanyProfile): SimulationResult {
  const rand = seededRandom(42);
  const days: DaySimulation[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  // Derive rates
  const docMissRate = profile.commonMissingDocs.length * 0.04;
  const billingDelayFactor = profile.claimBuildFrequency === "daily" ? 1 : profile.claimBuildFrequency === "weekly" ? 3.5 : 7;
  const pcsDelayFactor = profile.pcsObtainedWhen === "before_transport" ? 0.02 : profile.pcsObtainedWhen === "same_day" ? 0.08 : 0.18;
  const signatureIssueRate = profile.whoCollectsSignatures === "crew_on_scene" ? 0.03 : 0.12;
  const chartVerifyRate = profile.whoVerifiesCharts === "dedicated_qa" ? 0.95 : profile.whoVerifiesCharts === "dispatcher" ? 0.8 : 0.6;
  const timestampMissRate = profile.whenTimesEntered === "real_time" ? 0.02 : profile.whenTimesEntered === "end_of_day" ? 0.08 : 0.2;

  let totalTrips = 0, totalCompleted = 0, totalNoShows = 0, totalLatePatients = 0;
  let totalFacilityDelays = 0, totalPatientNotReady = 0;
  let totalClean = 0, totalBlocked = 0, totalReview = 0;
  let totalRevGen = 0, totalRevBlocked = 0;
  let totalMissingDocs = 0, totalBottlenecks = 0, totalCascadeDelays = 0;

  for (let d = 0; d < 30; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const dayMultiplier = isWeekend ? 0.7 : 1.0;
    const plannedTrips = Math.round(profile.tripsPerDayPerTruck * profile.truckCount * dayMultiplier);

    const noShows = Math.round(plannedTrips * (profile.noShowPercent / 100) * (0.7 + rand() * 0.6));
    const latePatients = Math.round(plannedTrips * (profile.latePatientPercent / 100) * (0.7 + rand() * 0.6));
    const facilityDelays = Math.round(plannedTrips * 0.05 * (0.5 + rand() * 1.0));
    const patientNotReady = Math.round(latePatients * 0.6);
    const completed = Math.max(0, plannedTrips - noShows);

    const dialysis = Math.round(completed * (profile.dialysisPercent / 100));
    const discharge = completed - dialysis;

    // Doc gate failure breakdown
    const missingTimestamps = Math.round(completed * timestampMissRate * (0.5 + rand() * 1.0));
    const missingMiles = Math.round(completed * 0.04 * (0.5 + rand() * 1.0));
    const missingSignatures = Math.round(completed * signatureIssueRate * (0.5 + rand() * 1.0));
    const missingPCS = Math.round(completed * pcsDelayFactor * (0.5 + rand() * 1.0));
    const missingNecessity = Math.round(completed * 0.06 * (0.5 + rand() * 1.0));
    const chartsFailing = Math.round(completed * (1 - chartVerifyRate) * (0.5 + rand() * 1.0));

    const totalDocIssues = Math.min(completed, missingTimestamps + missingMiles + missingSignatures + missingPCS + chartsFailing);
    const clean = Math.max(0, completed - totalDocIssues - Math.round(completed * (profile.denialPercent / 200)));
    const blocked = Math.min(completed - clean, Math.round(totalDocIssues * 0.6));
    const review = completed - clean - blocked;

    // Cascade delays: late patients causing downstream pickup failures
    const cascadeDelays = latePatients > profile.truckCount ? Math.round(latePatients * 0.4 * (profile.tripsPerDayPerTruck / 6)) : 0;
    const bottlenecks = latePatients > profile.truckCount ? Math.round(latePatients * 0.3) : 0;

    const revGen = clean * profile.revenuePerTrip;
    const revBlocked = blocked * profile.revenuePerTrip;

    totalTrips += plannedTrips;
    totalCompleted += completed;
    totalNoShows += noShows;
    totalLatePatients += latePatients;
    totalFacilityDelays += facilityDelays;
    totalPatientNotReady += patientNotReady;
    totalClean += clean;
    totalBlocked += blocked;
    totalReview += review;
    totalRevGen += revGen;
    totalRevBlocked += revBlocked;
    totalMissingDocs += totalDocIssues;
    totalBottlenecks += bottlenecks;
    totalCascadeDelays += cascadeDelays;

    days.push({
      day: d + 1,
      date: date.toISOString().split("T")[0],
      totalTrips: plannedTrips,
      dialysisTrips: dialysis,
      dischargeTrips: discharge,
      completedTrips: completed,
      noShows, latePatients, facilityDelays, patientNotReady,
      cleanClaims: clean, blockedClaims: blocked, reviewClaims: review,
      revenueGenerated: revGen, revenueBlocked: revBlocked,
      missingDocs: totalDocIssues, dispatchBottlenecks: bottlenecks, cascadeDelays,
      missingTimestamps, missingMiles, missingSignatures, missingPCS, missingNecessity,
    });
  }

  const cleanPercent = totalCompleted > 0 ? Math.round((totalClean / totalCompleted) * 100) : 0;
  const totalRevenueDelayed = totalReview * profile.revenuePerTrip * (billingDelayFactor / 7);
  const dispatchEfficiency = totalTrips > 0 ? Math.round((totalCompleted / totalTrips) * 100) : 0;

  // AR Aging
  const arAging = [
    { bucket: "0–30 days", amount: Math.round(totalRevGen * 0.4) },
    { bucket: "31–60 days", amount: Math.round(totalRevGen * 0.25) },
    { bucket: "61–90 days", amount: Math.round(totalRevGen * 0.15 * (profile.currentARDays / 45)) },
    { bucket: "90+ days", amount: Math.round(totalRevGen * 0.1 * (profile.currentARDays / 45)) },
  ];

  // Denial breakdown
  const denialBreakdown: DenialBreakdown[] = [];
  const totalDenials = Math.round(totalCompleted * (profile.denialPercent / 100));
  if (totalDenials > 0) {
    const reasons = profile.topDenialReasons.length > 0 ? profile.topDenialReasons : ["Missing authorization", "Missing PCS/signature"];
    const perReason = Math.round(totalDenials / reasons.length);
    reasons.forEach(r => {
      denialBreakdown.push({ category: r, count: perReason, revenue: perReason * profile.revenuePerTrip });
    });
  }

  // PodDispatch improvement projection
  const podDispatchDocGateReduction = 0.65; // 65% reduction in doc failures
  const podDispatchCleanWithSystem = Math.round(totalClean + totalBlocked * podDispatchDocGateReduction);
  const revCapturedWithPD = podDispatchCleanWithSystem * profile.revenuePerTrip;
  const revBlockedWithPD = Math.round(totalRevBlocked * (1 - podDispatchDocGateReduction));

  // Operational failures
  const failures: string[] = [];
  if (profile.noShowPercent > 10) failures.push(`High no-show rate (${profile.noShowPercent}%) wastes ${totalNoShows} crew-hours over 30 days`);
  if (profile.latePatientPercent > 15) failures.push(`Late patients (${profile.latePatientPercent}%) cause ${totalCascadeDelays} cascade delays across truck schedules`);
  if (docMissRate > 0.15) failures.push(`${profile.commonMissingDocs.length} categories of missing docs block ${totalMissingDocs} trips from billing`);
  if (profile.denialPercent > 8) failures.push(`${profile.denialPercent}% denial rate costs $${Math.round(totalRevBlocked * 0.3).toLocaleString()} monthly`);
  if (profile.claimBuildFrequency !== "daily") failures.push(`${profile.claimBuildFrequency} claim builds delay revenue by ~${Math.round(billingDelayFactor)} days`);
  if (timestampMissRate > 0.1) failures.push(`Crews entering times '${profile.whenTimesEntered}' — ${Math.round(timestampMissRate * totalCompleted)} trips missing timestamps`);

  const bottleneckDetails: string[] = [];
  if (profile.latePatientPercent > 10) bottleneckDetails.push("Late patients create cascading pickup delays across truck schedules");
  if (profile.tripsPerDayPerTruck > 8) bottleneckDetails.push("High trip density per truck leaves no buffer for delays");
  if (profile.shiftHours < 10 && profile.tripsPerDayPerTruck > 6) bottleneckDetails.push("Short shifts + high trip count = overtime risk");
  if (totalFacilityDelays > 30) bottleneckDetails.push(`~${totalFacilityDelays} facility delays over 30 days — system drift detection needed`);

  const docDetails: string[] = [];
  if (pcsDelayFactor > 0.1) docDetails.push(`PCS obtained '${profile.pcsObtainedWhen}' — ${Math.round(pcsDelayFactor * 100)}% of trips missing PCS at billing time`);
  if (signatureIssueRate > 0.05) docDetails.push(`Signatures collected by '${profile.whoCollectsSignatures}' — ${Math.round(signatureIssueRate * 100)}% missing`);
  if (timestampMissRate > 0.05) docDetails.push(`Times entered '${profile.whenTimesEntered}' — ${Math.round(timestampMissRate * 100)}% of trips missing timestamps`);
  profile.commonMissingDocs.forEach(doc => docDetails.push(`Frequently missing: ${doc}`));

  // Stress verdict
  const areas: SimulationResult["stressVerdict"]["areas"] = [];

  const dispatchScore = (profile.noShowPercent + profile.latePatientPercent) / 2;
  areas.push({
    area: "Dispatch Operations",
    verdict: dispatchScore < 8 ? "green" : dispatchScore < 15 ? "yellow" : "red",
    detail: dispatchScore < 8
      ? "Dispatch flow handles volume with adequate buffers"
      : dispatchScore < 15
        ? `Late patients and no-shows create moderate pressure — PodDispatch auto-alerts + drift detection help. ${totalCascadeDelays} cascade delays projected.`
        : `High disruption rate — ${totalCascadeDelays} cascade delays. System needs auto-reassignment to closest/least-loaded truck.`,
  });

  const docScore = docMissRate + pcsDelayFactor + signatureIssueRate + timestampMissRate;
  areas.push({
    area: "Documentation Gates",
    verdict: docScore < 0.1 ? "green" : docScore < 0.25 ? "yellow" : "red",
    detail: docScore < 0.1
      ? "Documentation workflow is clean — PodDispatch enforces gates to maintain this"
      : docScore < 0.25
        ? `Doc gaps exist (${totalMissingDocs} trips blocked). PodDispatch validation gates catch these before billing.`
        : `Critical doc failures — ${totalMissingDocs} trips blocked. Mandatory checklist enforcement before claim_ready.`,
  });

  const billingScore = profile.denialPercent + (profile.claimBuildFrequency === "daily" ? 0 : 5);
  areas.push({
    area: "Clean Claim Engine",
    verdict: billingScore < 8 ? "green" : billingScore < 15 ? "yellow" : "red",
    detail: billingScore < 8
      ? `Clean claim rate ${cleanPercent}% — strong. PodDispatch maintains with automated blockers.`
      : billingScore < 15
        ? `${cleanPercent}% clean claims, ${profile.denialPercent}% denials. Clean Claim Engine would improve to ~${Math.min(95, cleanPercent + 15)}%.`
        : `${cleanPercent}% clean claims — revenue leakage of $${Math.round(totalRevBlocked).toLocaleString()}. Immediate deployment critical.`,
  });

  const finScore = profile.currentARDays;
  areas.push({
    area: "Financial Health",
    verdict: finScore < 35 ? "green" : finScore < 55 ? "yellow" : "red",
    detail: finScore < 35
      ? "AR days healthy — PodDispatch accelerates with daily claim builds"
      : finScore < 55
        ? `AR aging ${finScore} days shows cash flow pressure. Faster builds + denial management needed.`
        : `Critical AR aging ${finScore} days — company financing payer delays. $${Math.round(totalRevenueDelayed).toLocaleString()} revenue delayed.`,
  });

  // Resilience check
  const resilienceScore = (totalCascadeDelays / Math.max(1, totalTrips)) * 100;
  areas.push({
    area: "System Resilience",
    verdict: resilienceScore < 2 ? "green" : resilienceScore < 5 ? "yellow" : "red",
    detail: resilienceScore < 2
      ? "System tolerates late facilities, no-shows, and crew update gaps"
      : resilienceScore < 5
        ? "Moderate fragility — PodDispatch drift detection + delay simulation mitigate this"
        : "High fragility — crews forgetting updates cause silent drift. Auto-prompt + threshold alerts critical.",
  });

  const verdicts = areas.map(a => a.verdict);
  const overall: "green" | "yellow" | "red" = verdicts.includes("red")
    ? "red"
    : verdicts.filter(v => v === "yellow").length >= 2
      ? "yellow"
      : verdicts.includes("yellow")
        ? "yellow"
        : "green";

  return {
    days,
    summary: {
      totalTrips,
      totalCompleted,
      totalNoShows,
      totalLatePatients,
      totalFacilityDelays,
      totalPatientNotReady,
      totalCleanClaims: totalClean,
      totalBlockedClaims: totalBlocked,
      totalReviewClaims: totalReview,
      cleanClaimPercent: cleanPercent,
      totalRevenueGenerated: Math.round(totalRevGen),
      totalRevenueBlocked: Math.round(totalRevBlocked),
      totalRevenueDelayed: Math.round(totalRevenueDelayed),
      totalMissingDocs,
      totalDispatchBottlenecks: totalBottlenecks,
      totalCascadeDelays,
      arAging,
      avgDaysToPayment: Math.round(profile.avgPaymentDays * (1 - cleanPercent / 200)),
      denialBreakdown,
      operationalFailures: failures,
      dispatchBottleneckDetails: bottleneckDetails,
      docFailureDetails: docDetails,
      dispatchEfficiency,
      revenueCapturedWithPodDispatch: Math.round(revCapturedWithPD),
      revenueBlockedWithPodDispatch: Math.round(revBlockedWithPD),
      improvementDelta: Math.round(revCapturedWithPD - totalRevGen),
    },
    stressVerdict: { overall, areas },
  };
}
