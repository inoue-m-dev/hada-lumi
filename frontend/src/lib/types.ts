export type DailyRecordUpsertPayload = {
    date: string;                 // "YYYY-MM-DD"
    skin_condition: number;       // 1-5
    sleep: number;                // 1-5
    stress: number;               // 1-5
    skincare_effort: number;      // 1-5
    menstruation_status?: boolean; // true/false（生理管理画面に分離したため任意）
    water_intake?: number | null; // 今フォームにないなら省略でOK
    memo?: string | null;
    env_pref_code: string;        // "13" など
  };