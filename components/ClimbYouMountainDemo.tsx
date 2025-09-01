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
  'M80,560 C 120,540 160,510 220,490 C 280,470 340,440 400,410 C 460,380 520,340 580,300 C 640,260 680,220 720,180 C 750,160 770,140 780,120 C 785,115 790,110 795,105';

export default function MountainProgress({
  progress: progressProp,
  onProgressChange,
  checkpoints = [0.2, 0.45, 0.7, 1],
}: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Controlled or Uncontrolled
  const [progressState, setProgressState] = useState(0);
  const isControlled = progressProp !== undefined;
  const progress = isControlled ? Math.max(0, Math.min(1, progressProp!)) : progressState;

  // パス関連
  const pathRef = useRef<SVGPathElement>(null);
  const [total, setTotal] = useState(1);
  const [len, setLen] = useState(0);
  const [pose, setPose] = useState({ x: 0, y: 0, angle: 0 });

  // ズーム機能用の状態管理
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCenter, setZoomCenter] = useState({ x: 400, y: 300 });
  const [lastProgress, setLastProgress] = useState(0);
  // アニメーション状態（完全分離）
  const [animationState, setAnimationState] = useState<'idle' | 'zooming-in' | 'moving' | 'zooming-out'>('idle');

  useEffect(() => {
    const p = pathRef.current;
    if (p) setTotal(p.getTotalLength());
  }, []);

  // 進捗変化を検知（ズームトリガー用）
  useEffect(() => {
    if (progress > lastProgress && progress - lastProgress >= 0.05) {
      console.log('🔍 ズーム条件達成:', {
        前回: (lastProgress * 100).toFixed(0) + '%',
        現在: (progress * 100).toFixed(0) + '%',
        差分: ((progress - lastProgress) * 100).toFixed(0) + '%',
        ハイカー位置: { x: pose.x, y: pose.y }
      });
      
      // 新しい進捗位置を事前計算してズーム中心を正確に設定
      const path = pathRef.current;
      if (path) {
        const target = progress * total;
        const futurePoint = path.getPointAtLength(target);
        
        // 境界条件を考慮した角度計算
        let futurePoint2;
        let futureAngle;
        
        if (target < 3) {
          // 開始点近く：少し先の点を使用
          futurePoint2 = path.getPointAtLength(Math.min(total, 5));
          futureAngle = (Math.atan2(futurePoint2.y - futurePoint.y, futurePoint2.x - futurePoint.x) * 180) / Math.PI;
        } else if (target > total - 3) {
          // 終点近く：少し前の点を使用
          const prevPoint = path.getPointAtLength(Math.max(0, target - 5));
          futureAngle = (Math.atan2(futurePoint.y - prevPoint.y, futurePoint.x - prevPoint.x) * 180) / Math.PI;
        } else {
          // 通常：前方の点を使用
          futurePoint2 = path.getPointAtLength(Math.min(total, target + 2.0));
          futureAngle = (Math.atan2(futurePoint2.y - futurePoint.y, futurePoint2.x - futurePoint.x) * 180) / Math.PI;
        }
        
        // 角度に応じて足元位置を動的計算
        const angleRad = (futureAngle * Math.PI) / 180;
        const footOffsetX = -Math.cos(angleRad + Math.PI/2) * 8; // 進行方向に対して垂直左向き
        const footOffsetY = -Math.sin(angleRad + Math.PI/2) * 8 + 25; // 下向き成分も追加
        
        setZoomCenter({ 
          x: futurePoint.x + footOffsetX, 
          y: futurePoint.y + footOffsetY 
        });
      }
      
      // ステップ1: ズームイン開始
      setAnimationState('zooming-in');
      console.log('🎬 ステップ1: ズームイン開始');
      
      animate(zoomLevel, 3, {
        duration: 0.7 / 0.75, // 0.75倍速、0.1秒短縮 = 0.93秒
        ease: [0.2, 0, 0.3, 1],
        onUpdate: setZoomLevel,
        onComplete: () => {
          // 0.2秒の小休止後に移動許可
          setTimeout(() => {
            console.log('🎬 ステップ2: 移動許可（0.2秒遅延後）');
            setAnimationState('moving');
          }, 200);
          
          // 移動完了を待つ（0.2秒の遅延を考慮）
          setTimeout(() => {
            // ステップ3: ズームアウト開始
            console.log('🎬 ステップ3: ズームアウト開始');
            setAnimationState('zooming-out');
            
            animate(zoomLevel, 1, {
              duration: 1.1 / 0.75, // 0.75倍速、0.1秒短縮 = 1.47秒
              ease: [0.4, 0, 0.2, 1],
              onUpdate: setZoomLevel,
              onComplete: () => {
                console.log('🎬 完了: 通常状態に戻る');
                setAnimationState('idle');
              }
            });
          }, 1000 / 0.75 + 200); // 移動時間1.33秒 + 0.2秒遅延 = 1.53秒後
        }
      });
    }
    setLastProgress(progress);
  }, [progress, lastProgress, pose.x, pose.y]);

  // 進捗→位置（完全分離制御）
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    
    // 移動が許可されている時のみ実行（'idle'時は常に移動可能、'moving'時のみズーム中の移動許可）
    if (animationState !== 'moving' && animationState !== 'idle') {
      console.log(`⏸️ 移動停止中 (状態: ${animationState})`);
      return;
    }
    
    const target = progress * total;

    if (!isMounted || prefersReducedMotion) {
      const pt = path.getPointAtLength(target);
      
      // 境界条件を考慮した角度計算
      let angle;
      if (target < 3) {
        const pt2 = path.getPointAtLength(Math.min(total, 5));
        angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
      } else if (target > total - 3) {
        const prevPt = path.getPointAtLength(Math.max(0, target - 5));
        angle = (Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x) * 180) / Math.PI;
      } else {
        const pt2 = path.getPointAtLength(Math.min(total, target + 2.0));
        angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
      }
      
      setPose({ x: pt.x, y: pt.y, angle });
      setLen(target);
      return;
    }

    const ctrl = animate(len, target, {
      duration: 1.2 / 0.75, // より長めの時間で滑らかに = 1.6秒
      ease: [0.15, 0.05, 0.15, 1], // さらに滑らかなイージング
      onUpdate: (L) => {
        const pt = path.getPointAtLength(L);
        
        // 境界条件を考慮した角度計算（ズーム中心計算と同じロジック）
        let angle;
        if (L < 3) {
          // 開始点近く
          const pt2 = path.getPointAtLength(Math.min(total, 5));
          angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
        } else if (L > total - 3) {
          // 終点近く
          const prevPt = path.getPointAtLength(Math.max(0, L - 5));
          angle = (Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x) * 180) / Math.PI;
        } else {
          // 通常
          const pt2 = path.getPointAtLength(Math.min(total, L + 2.0));
          angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
        }
        
        setPose({ x: pt.x, y: pt.y, angle });
        setLen(L);
      },
    });
    return () => ctrl.stop();
  }, [progress, total, prefersReducedMotion, animationState]);

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

      <div 
        className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-950" 
        style={isMounted ? { 
          overflow: zoomLevel > 1 ? 'visible' : 'hidden' // ズーム時のみoverflow許可
        } : {}}
      >
        <motion.svg 
          viewBox={zoomLevel > 1 ? "-200 -150 1200 900" : "0 0 800 600"}
          className="block w-full h-auto"
          animate={isMounted ? {
            scale: zoomLevel,
            transformOrigin: `${zoomCenter.x}px ${zoomCenter.y}px`
          } : {}}
          transition={{ duration: 0.7 / 0.75, ease: [0.2, 0, 0.3, 1] }}
        >
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
          <rect x="-200" y="-150" width="1200" height="900" fill="url(#sky)" />
          {/* 星（静的配置でhydration問題を回避） */}
          {[...Array(120)].map((_, i) => {
            // 完全に決定論的な位置計算
            const seedA = (i * 97 + 13) % 1200 - 200;
            const seedB = (i * 53 + 7) % 400 - 150;
            return (
              <circle
                key={i}
                cx={seedA}
                cy={seedB}
                r={i % 4 === 0 ? 1.8 : i % 3 === 0 ? 1.4 : 1}
                fill="#cfe7ff"
                opacity={0.6}
              />
            );
          })}
          {/* 月（左上に配置、グロー効果なし） */}
          <circle cx="150" cy="80" r={35} fill="#ffe7aa" />

          {/* 背景の山（遠→近 - 明るい色調） */}
          <g style={parallax(8)}>
            <path d="M-200,420 C-80,380 40,370 180,380 C320,390 440,350 600,300 C760,350 920,380 1000,300 L1000,750 L-200,750 Z" fill="#4a6b85" opacity="0.7" />
            <path d="M20,390 L100,300 L160,390 Z" fill="#4a6b85" opacity="0.75" />
            <path d="M320,400 L390,310 L460,400 Z" fill="#4a6b85" opacity="0.72" />
            <path d="M720,400 L790,310 L860,400 Z" fill="#4a6b85" opacity="0.72" />
          </g>
          <g style={parallax(22)}>
            <path d="M-200,480 C-40,440 100,430 270,420 C420,410 520,370 600,340 C720,370 880,440 1000,340 L1000,750 L-200,750 Z" fill="#5a7b95" />
          </g>
          <g style={parallax(38)}>
            <path d="M-200,540 C-20,510 140,505 320,495 C470,485 540,460 600,445 C720,460 880,510 1000,445 L1000,750 L-200,750 Z" fill="#6a8ba5" />
          </g>
          <rect x="-200" y="480" width="1200" height="270" fill="url(#haze)" />

          {/* ====== ベースの道（山の後ろにある淡い道） ====== */}
          <path d={TRAIL_D} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={8} strokeLinecap="round" />

          {/* ====== 前景の山（道の輪郭に沿って配置 - 明るい色調） ====== */}
          <g>
            {/* 道の下側の山々（道の輪郭の下） */}
            <path d="M-200,750 L-120,730 L-40,680 L40,660 L120,630 L200,600 L280,570 L360,530 L440,490 L520,350 L600,300 L680,250 L720,200 L800,150 L880,200 L960,300 L1000,400 L1000,750 Z" fill="#2d5a7b" />
            
            {/* 道の上側の山々（道の輪郭の上） */}
            <path d="M-200,650 L-100,630 L0,600 L100,580 L200,550 L300,520 L400,490 L500,460 L600,420 L700,380 L760,210 L800,210 L840,250 L920,350 L1000,650 L920,450 L840,350 L800,320 L760,320 L700,420 L600,450 L500,480 L400,510 L300,540 L200,570 L100,600 L0,630 L-100,650 Z" fill="#3a6b8c" />
            
            {/* 主峰（最終目標地点） */}
            <path d="M700,750 L750,300 L760,210 L780,200 L800,220 L820,250 L850,300 L900,400 L950,500 L1000,750 Z" fill="#4a7ba0" />
            
            {/* 道沿いの岩場 */}
            <path d="M150,750 L180,670 L220,650 L250,670 L280,750 Z" fill="#1e3a5f" />
            <path d="M450,750 L480,580 L520,560 L550,580 L580,750 Z" fill="#1e3a5f" />
            <path d="M-150,750 L-120,680 L-80,660 L-50,680 L-20,750 Z" fill="#1e3a5f" />
            <path d="M850,750 L880,580 L920,560 L950,580 L980,750 Z" fill="#1e3a5f" />
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
            </g>
          ))}

          {/* ====== ハイカー（最前面） ====== */}
          <g transform={`translate(${pose.x}, ${pose.y}) rotate(${pose.angle})`} filter="url(#shadow)">
            <image href="/hiker.svg" width="60" height="72" x={-30} y={-60} preserveAspectRatio="xMidYMid meet" />
          </g>
        </motion.svg>
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
