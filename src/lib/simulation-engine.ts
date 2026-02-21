// Company Simulation Engine — generates a 30-day operational simulation from questionnaire inputs

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
  cleanClaims: number;
  blockedClaims: number;
  reviewClaims: number;
  revenueGenerated: number;
  revenueBlocked: number;
  missingDocs: number;
  dispatchBottlenecks: number;
}

export interface SimulationResult {
  days: DaySimulation[];
  summary: {
    totalTrips: number;
    totalCompleted: number;
    totalNoShows: number;
    totalLatePatients: number;
    totalCleanClaims: number;
    totalBlockedClaims: number;
    totalReviewClaims: number;
    cleanClaimPercent: number;
    totalRevenueGenerated: number;
    totalRevenueBlocked: number;
    totalRevenueDelayed: number;
    totalMissingDocs: number;
    totalDispatchBottlenecks: number;
    arAging: { bucket: string; amount: number }[];
    avgDaysToPayment: number;
    operationalFailures: string[];
    dispatchBottleneckDetails: string[];
    docFailureDetails: string[];
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
  const docMissRate = profile.commonMissingDocs.length * 0.04; // each missing doc type = ~4% miss rate
  const billingDelayFactor = profile.claimBuildFrequency === "daily" ? 1 : profile.claimBuildFrequency === "weekly" ? 3.5 : 7;
  const pcsDelayFactor = profile.pcsObtainedWhen === "before_transport" ? 0.02 : profile.pcsObtainedWhen === "same_day" ? 0.08 : 0.18;
  const signatureIssueRate = profile.whoCollectsSignatures === "crew_on_scene" ? 0.03 : 0.12;
  const chartVerifyRate = profile.whoVerifiesCharts === "dedicated_qa" ? 0.95 : profile.whoVerifiesCharts === "dispatcher" ? 0.8 : 0.6;

  let totalTrips = 0, totalCompleted = 0, totalNoShows = 0, totalLatePatients = 0;
  let totalClean = 0, totalBlocked = 0, totalReview = 0;
  let totalRevGen = 0, totalRevBlocked = 0;
  let totalMissingDocs = 0, totalBottlenecks = 0;

  for (let d = 0; d < 30; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Weekends have ~30% less trips
    const dayMultiplier = isWeekend ? 0.7 : 1.0;
    const plannedTrips = Math.round(profile.tripsPerDayPerTruck * profile.truckCount * dayMultiplier);

    const noShows = Math.round(plannedTrips * (profile.noShowPercent / 100) * (0.7 + rand() * 0.6));
    const latePatients = Math.round(plannedTrips * (profile.latePatientPercent / 100) * (0.7 + rand() * 0.6));
    const completed = Math.max(0, plannedTrips - noShows);

    const dialysis = Math.round(completed * (profile.dialysisPercent / 100));
    const discharge = completed - dialysis;

    // Documentation issues
    const missingDocs = Math.round(completed * (docMissRate + pcsDelayFactor + signatureIssueRate) * (0.5 + rand() * 1.0));
    const chartsFailing = Math.round(completed * (1 - chartVerifyRate) * (0.5 + rand() * 1.0));

    // Billing readiness
    const totalDocIssues = Math.min(completed, missingDocs + chartsFailing);
    const clean = Math.max(0, completed - totalDocIssues - Math.round(completed * (profile.denialPercent / 200)));
    const blocked = Math.min(completed - clean, Math.round(totalDocIssues * 0.6));
    const review = completed - clean - blocked;

    // Dispatch bottlenecks (late patients causing cascade delays)
    const bottlenecks = latePatients > profile.truckCount ? Math.round(latePatients * 0.3) : 0;

    const revGen = clean * profile.revenuePerTrip;
    const revBlocked = blocked * profile.revenuePerTrip;

    totalTrips += plannedTrips;
    totalCompleted += completed;
    totalNoShows += noShows;
    totalLatePatients += latePatients;
    totalClean += clean;
    totalBlocked += blocked;
    totalReview += review;
    totalRevGen += revGen;
    totalRevBlocked += revBlocked;
    totalMissingDocs += missingDocs;
    totalBottlenecks += bottlenecks;

    days.push({
      day: d + 1,
      date: date.toISOString().split("T")[0],
      totalTrips: plannedTrips,
      dialysisTrips: dialysis,
      dischargeTrips: discharge,
      completedTrips: completed,
      noShows,
      latePatients,
      cleanClaims: clean,
      blockedClaims: blocked,
      reviewClaims: review,
      revenueGenerated: revGen,
      revenueBlocked: revBlocked,
      missingDocs,
      dispatchBottlenecks: bottlenecks,
    });
  }

  const cleanPercent = totalCompleted > 0 ? Math.round((totalClean / totalCompleted) * 100) : 0;
  const totalRevenueDelayed = totalReview * profile.revenuePerTrip * (billingDelayFactor / 7);

  // AR Aging
  const arAging = [
    { bucket: "0–30 days", amount: Math.round(totalRevGen * 0.4) },
    { bucket: "31–60 days", amount: Math.round(totalRevGen * 0.25) },
    { bucket: "61–90 days", amount: Math.round(totalRevGen * 0.15 * (profile.currentARDays / 45)) },
    { bucket: "90+ days", amount: Math.round(totalRevGen * 0.1 * (profile.currentARDays / 45)) },
  ];

  // Operational failures
  const failures: string[] = [];
  if (profile.noShowPercent > 10) failures.push(`High no-show rate (${profile.noShowPercent}%) wastes ${totalNoShows} crew-hours over 30 days`);
  if (profile.latePatientPercent > 15) failures.push(`Late patients (${profile.latePatientPercent}%) cause ${totalBottlenecks} cascade delays`);
  if (docMissRate > 0.15) failures.push(`${profile.commonMissingDocs.length} categories of missing docs block ${totalMissingDocs} trips`);
  if (profile.denialPercent > 8) failures.push(`${profile.denialPercent}% denial rate costs $${Math.round(totalRevBlocked * 0.3).toLocaleString()} monthly`);
  if (profile.claimBuildFrequency !== "daily") failures.push(`${profile.claimBuildFrequency} claim builds delay revenue by ${Math.round(billingDelayFactor)} days`);

  const bottleneckDetails: string[] = [];
  if (profile.latePatientPercent > 10) bottleneckDetails.push("Late patients create cascading pickup delays across truck schedules");
  if (profile.tripsPerDayPerTruck > 8) bottleneckDetails.push("High trip density per truck leaves no buffer for delays");
  if (profile.shiftHours < 10 && profile.tripsPerDayPerTruck > 6) bottleneckDetails.push("Short shifts + high trip count = overtime risk");

  const docDetails: string[] = [];
  if (pcsDelayFactor > 0.1) docDetails.push(`PCS obtained '${profile.pcsObtainedWhen}' — ${Math.round(pcsDelayFactor * 100)}% of trips missing PCS at billing time`);
  if (signatureIssueRate > 0.05) docDetails.push(`Signatures collected by '${profile.whoCollectsSignatures}' — ${Math.round(signatureIssueRate * 100)}% missing`);
  profile.commonMissingDocs.forEach(doc => docDetails.push(`Frequently missing: ${doc}`));

  // Stress verdict
  const areas: SimulationResult["stressVerdict"]["areas"] = [];

  // Dispatch
  const dispatchScore = (profile.noShowPercent + profile.latePatientPercent) / 2;
  areas.push({
    area: "Dispatch Operations",
    verdict: dispatchScore < 8 ? "green" : dispatchScore < 15 ? "yellow" : "red",
    detail: dispatchScore < 8
      ? "Dispatch flow handles volume with adequate buffers"
      : dispatchScore < 15
        ? "Late patients and no-shows create moderate pressure — PodDispatch auto-alerts help"
        : "High disruption rate — system needs crew notifications + auto-reassignment",
  });

  // Documentation
  const docScore = docMissRate + pcsDelayFactor + signatureIssueRate;
  areas.push({
    area: "Clinical Documentation",
    verdict: docScore < 0.1 ? "green" : docScore < 0.25 ? "yellow" : "red",
    detail: docScore < 0.1
      ? "Documentation workflow is clean — PodDispatch enforces it further"
      : docScore < 0.25
        ? "Some doc gaps exist — PodDispatch validation gates will catch them before billing"
        : "Critical doc failures — mandatory checklist enforcement needed before go-live",
  });

  // Billing
  const billingScore = profile.denialPercent + (profile.claimBuildFrequency === "daily" ? 0 : 5);
  areas.push({
    area: "Billing & Claims",
    verdict: billingScore < 8 ? "green" : billingScore < 15 ? "yellow" : "red",
    detail: billingScore < 8
      ? "Clean claim rate is strong — PodDispatch will maintain it"
      : billingScore < 15
        ? "Denial rate and build frequency need improvement — Clean Claim Engine addresses this"
        : "Revenue leakage is significant — immediate Clean Claim Engine deployment critical",
  });

  // Financial
  const finScore = profile.currentARDays;
  areas.push({
    area: "Financial Health",
    verdict: finScore < 35 ? "green" : finScore < 55 ? "yellow" : "red",
    detail: finScore < 35
      ? "AR days are healthy — PodDispatch accelerates further"
      : finScore < 55
        ? "AR aging shows cash flow pressure — faster claim builds and denial management needed"
        : "Critical AR aging — company is financing payer delays, needs immediate intervention",
  });

  // Overall
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
      totalCleanClaims: totalClean,
      totalBlockedClaims: totalBlocked,
      totalReviewClaims: totalReview,
      cleanClaimPercent: cleanPercent,
      totalRevenueGenerated: Math.round(totalRevGen),
      totalRevenueBlocked: Math.round(totalRevBlocked),
      totalRevenueDelayed: Math.round(totalRevenueDelayed),
      totalMissingDocs,
      totalDispatchBottlenecks: totalBottlenecks,
      arAging,
      avgDaysToPayment: Math.round(profile.avgPaymentDays * (1 - cleanPercent / 200)),
      operationalFailures: failures,
      dispatchBottleneckDetails: bottleneckDetails,
      docFailureDetails: docDetails,
    },
    stressVerdict: { overall, areas },
  };
}
