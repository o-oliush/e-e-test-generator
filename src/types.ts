export type ActionKind = 'navigate' | 'click' | 'type' | 'assert';

export interface ActionBase {
  kind: ActionKind;
  // Optional timestamp from video analysis
  ts?: number;
}

export interface NavigateAction extends ActionBase {
  kind: 'navigate';
  url: string;
}

export interface ClickAction extends ActionBase {
  kind: 'click';
  // Preferred selector fields (in priority order)
  role?: string; // e.g., 'button', 'link'
  name?: string; // accessible name / visible text
  testId?: string;
  selector?: string; // CSS fallback
}

export interface TypeAction extends ActionBase {
  kind: 'type';
  label?: string; // associated label text
  selector?: string; // CSS fallback
  value: string;
}

export interface AssertAction extends ActionBase {
  kind: 'assert';
  text?: string; // expected visible text
  selector?: string; // optional selector if asserting on element
}

export type Action = NavigateAction | ClickAction | TypeAction | AssertAction;
