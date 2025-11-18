export type CheckoutDto = {
  courseId: number;
  enrollType: 'RECORDED' | 'ONLINE';
  selectedStartDate?: string; // ISO date string when ONLINE
};