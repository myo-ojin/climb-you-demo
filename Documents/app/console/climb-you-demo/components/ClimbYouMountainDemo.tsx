'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, animate, useReducedMotion } from 'framer-motion';

type Props = {
  /** 0..1 を渡すと外部制御（省略時は内部ボタンで進む） */
  progress?: number;
  onProgressChange?: (p: number) => void;
  /** チェックポイント（0..1） */
  checkpoints?: number[];
};

/** ★道の形を山の輪郭に沿うように変更 */
const TRAIL_D =
  'M80,560 C 120,540 160,510 220,490 C 280,470 340,440 400,410 C 460,380 520,340 580,300 C 640,260 680,220 720,180 C 740,160 750,140 760,110';

export default function MountainProgress({
  progress: progressProp,
  onProgressChange,
  checkpoints = [0.2, 0.45, 0.7, 1],
}: Props) {
  const prefersReducedMotion = useReducedMotion();

  // Controlled or Uncontrolled
  const [progressState, setProgressState] = useState(0);
  const isControlled = progressProp !== undefined;
  const progress = isControlled ? Math.max(0, Math.min(1, progressProp!)) : progressState;

  // パス関連
  const pathRef = useRef<SVGPathElement>(null);
  const [total, setTotal] = useState(1);
  const [len, setLen] = useState(0);
  const [pose, setPose] = useState({ x: 0, y: 0, angle: 0 });

  useEffect(() => {
    const p = pathRef.current;
    if (p) setTotal(p.getTotalLength());
  }, []);

  // 進捗→位置
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const target = progress * total;

    if (prefersReducedMotion) {
      const pt = path.getPointAtLength(target);
      const pt2 = path.getPointAtLength(Math.min(total, target + 0.5));
      const angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
      setPose({ x: pt.x, y: pt.y, angle });
      setLen(target);
      return;
    }

    const ctrl = animate(len, target, {
      duration: 0.9,
      ease: [0.2, 0.6, 0.3, 1],
      onUpdate: (L) => {
        const pt = path.getPointAtLength(L);
        const pt2 = path.getPointAtLength(Math.min(total, L + 0.5));
        const angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
        setPose({ x: pt.x, y: pt.y, angle });
        setLen(L);
      },
    });
    return () => ctrl.stop();
  }, [progress, total, prefersReducedMotion]);

  // ダッシュ（通過部分のみ）
  const dash = useMemo(() => `${total} ${total}`, [total]);
  const dashOffset = useMemo(() => total - len, [total, len]);

  // デモ用操作
  const inc = (step = 0.1) => {
    const next = Math.min(1, progress + step);
    if (isControlled) onProgressChange?.(next);
    else setProgressState(next);
  };
  const reset = () => {
    if (isControlled) onProgressChange?.(0);
    else {
      setProgressState(0);
      setLen(0);
    }
  };

  // パララックス
  const parallax = (base: number) => ({ transform: `translateY(${(1 - progress) * base}px)` });

  // チェックポイント座標
  const cps = useMemo(() => {
    const path = pathRef.current;
    if (!path) return [] as { x: number; y: number; p: number }[];
    return checkpoints.map((p) => {
      const L = Math.max(0, Math.min(1, p)) * total;
      const pt = path.getPointAtLength(L);
      return { x: pt.x, y: pt.y, p };
    });
  }, [checkpoints, total, len]);
  const reached = cps.filter((c) => progress >= c.p - 1e-3).map((c) => c.p);

  return (
    <div className="min-h-[640px] w-full bg-slate-900 flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-center text-slate-100">
        <h1 className="text-2xl font-semibold tracking-tight">Climb You – Quest Progress</h1>
        <p className="opacity-80">山を前面にも配置して、ほんまに斜面を登ってる見た目に。</p>
      </div>

      <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-950">
        <svg viewBox="0 0 800 600" className="block w-full h-auto">
          {/* ====== defs ====== */}
          <defs>
            {/* 空 */}
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f2947" />
              <stop offset="100%" stopColor="#081b30" />
            </linearGradient>
            {/* 地表の霧 */}
            <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(12,28,48,0)" />
              <stop offset="100%" stopColor="rgba(12,28,48,0.55)" />
            </linearGradient>
            {/* 影 */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* ====== 背景 ====== */}
          <rect width="800" height="600" fill="url(#sky)" />
          {/* 星（ランダム配置） */}
          {useMemo(() => 
            [...Array(80)].map((_, i) => {
              // シードを使った疑似ランダム生成（一貫性のため）
              const seed = i * 12345;
              const randomX = (seed * 9301 + 49297) % 800;
              const randomY = (seed * 233280 + 851) % 280 + 10; // 上部280pxの範囲
              return (
                <motion.circle
                  key={i}
                  cx={randomX}
                  cy={randomY}
                  r={i % 4 === 0 ? 1.8 : i % 3 === 0 ? 1.4 : 1}
                  fill="#cfe7ff"
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: [0.3, 0.85, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2 + (i % 5) * 0.45, delay: i * 0.04 }}
                />
              );
            }), []
          )}
          {/* 月（左上に配置、グロー効果なし） */}
          <circle cx="150" cy="80" r={35} fill="#ffe7aa" />

          {/* 背景の山（遠→近 - 明るい色調） */}
          <g style={parallax(8)}>
            <path d="M0,420 C120,380 240,370 380,380 C520,390 640,350 800,300 L800,600 L0,600 Z" fill="#4a6b85" opacity="0.7" />
            <path d="M220,390 L300,300 L360,390 Z" fill="#4a6b85" opacity="0.75" />
            <path d="M520,400 L590,310 L660,400 Z" fill="#4a6b85" opacity="0.72" />
          </g>
          <g style={parallax(22)}>
            <path d="M0,480 C160,440 300,430 470,420 C620,410 720,370 800,340 L800,600 L0,600 Z" fill="#5a7b95" />
          </g>
          <g style={parallax(38)}>
            <path d="M0,540 C180,510 340,505 520,495 C670,485 740,460 800,445 L800,600 L0,600 Z" fill="#6a8ba5" />
          </g>
          <rect x="0" y="480" width="800" height="120" fill="url(#haze)" />

          {/* ====== ベースの道（山の後ろにある淡い道） ====== */}
          <path d={TRAIL_D} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={8} strokeLinecap="round" />

          {/* ====== 前景の山（道の輪郭に沿って配置 - 明るい色調） ====== */}
          <g>
            {/* 道の下側の山々（道の輪郭の下） */}
            <path d="M0,600 L80,580 L160,530 L240,510 L320,480 L400,450 L480,420 L560,380 L640,340 L720,200 L800,150 L800,600 Z" fill="#2d5a7b" />
            
            {/* 道の上側の山々（道の輪郭の上） */}
            <path d="M0,500 L100,480 L200,450 L300,420 L400,390 L500,360 L600,320 L700,280 L760,110 L800,110 L800,500 L700,320 L600,350 L500,380 L400,410 L300,440 L200,470 L100,500 Z" fill="#3a6b8c" />
            
            {/* 主峰（最終目標地点） */}
            <path d="M700,600 L750,200 L760,110 L780,100 L800,120 L800,600 Z" fill="#4a7ba0" />
            
            {/* 道沿いの岩場 */}
            <path d="M150,600 L180,520 L220,500 L250,520 L280,600 Z" fill="#1e3a5f" />
            <path d="M450,600 L480,430 L520,410 L550,430 L580,600 Z" fill="#1e3a5f" />
          </g>

          {/* ====== オーバーペイントの"進捗ハイライトの道"（最前面） ====== */}
          <motion.path
            ref={pathRef}
            d={TRAIL_D}
            fill="none"
            stroke="#ffffff"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dash}
            style={{ strokeDashoffset: dashOffset }}
            pointerEvents="none"
          />

          {/* ====== チェックポイント ====== */}
          {cps.map((c) => (
            <g key={c.p} transform={`translate(${c.x}, ${c.y})`}>
              <circle r={3} fill="#ffffff" opacity="0.95" />
              {reached.includes(c.p) && (
                <>
                  <motion.circle
                    r={6}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={1}
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{ duration: 0.9 }}
                  />
                  {[...Array(7)].map((_, i) => (
                    <motion.line
                      key={i}
                      x1={0}
                      y1={0}
                      x2={Math.cos((i * Math.PI * 2) / 7) * 12}
                      y2={Math.sin((i * Math.PI * 2) / 7) * 12}
                      stroke="#ffe7aa"
                      strokeWidth={1.6}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0.2, 1, 1.1] }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                  ))}
                </>
              )}
            </g>
          ))}

          {/* ====== ハイカー（最前面） ====== */}
          <g transform={`translate(${pose.x}, ${pose.y}) rotate(${pose.angle})`} filter="url(#shadow)">
            <image href="/hiker.svg" width="60" height="72" x={-30} y={-60} preserveAspectRatio="xMidYMid meet" />
          </g>
        </svg>
      </div>

      {/* デモ用UI（Uncontrolled の時だけ表示） */}
      {!isControlled && (
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded-2xl bg-sky-500 text-white shadow hover:brightness-110 active:translate-y-[1px]"
            onClick={() => inc(0.1)}
          >
            クエスト達成 (+10%)
          </button>
          <button className="px-4 py-2 rounded-2xl bg-slate-700 text-white/90 hover:bg-slate-600" onClick={reset}>
            リセット
          </button>
          <div className="text-slate-200 tabular-nums ml-2">進捗 {(progress * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
}
