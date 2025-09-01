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
  const zoom = useMotionValue(1);
  const [zoomCenter, setZoomCenter] = useState({ x: 400, y: 300 });
  const [lastProgress, setLastProgress] = useState(0);
  // アニメーション状態（完全分離）
  const [animationState, setAnimationState] = useState<'idle' | 'zooming-in' | 'moving' | 'zooming-out'>('idle');

  useEffect(() => {
    const p = pathRef.current;
    if (p) setTotal(p.getTotalLength());
  }, []);

  // Debug: ensure MotionValue updates (remove if noisy)
  useEffect(() => {
    const unsub = (zoom as any).on?.('change', (v: number) => {
      // console.debug('zoom=', v);
    });
    return () => { unsub?.(); };
  }, [zoom]);

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
      
      animate(zoom, 3, {
        duration: 0.7 / 0.75, // 0.75倍速、0.1秒短縮 = 0.93秒
        ease: [0.2, 0, 0.3, 1],
        
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
            const __hold = progress >= 0.95 ? 450 : 0;
            setTimeout(() => {
            
            animate(zoom, 1, {
              duration: 1.1 / 0.75, // 0.75倍速、0.1秒短縮 = 1.47秒
              ease: [0.4, 0, 0.2, 1],
              
              onComplete: () => {
                console.log('🎬 完了: 通常状態に戻る');
                setAnimationState('idle');
              }
            });
            }, __hold);
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
  // 現在のズーム倍率（MotionValue から即座に参照）
  const zoomLevel = (typeof (zoom as any).get === 'function') ? (zoom as any).get() as number : 1;
  // CSS transform for SVG group: translate(px, px) -> scale -> translate(-px, -px)
  const cameraTransformCss = useMotionTemplate`translate(${zoomCenter.x}px, ${zoomCenter.y}px) scale(${zoom}) translate(-${zoomCenter.x}px, -${zoomCenter.y}px)`;

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
          viewBox="0 0 800 600" 
          className="block w-full h-auto"
        >
          {/* ====== defs ====== */}
          <defs>
            {/* 空 */}
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--night-sky-top)" />
              <stop offset="100%" stopColor="var(--night-sky-bottom)" />
            </linearGradient>
            {/* 月グロー */}
            <radialGradient id="moonGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(150 80) scale(90)">
              <stop offset="0%" stopColor="var(--night-moon)" stopOpacity="0.95" />
              <stop offset="60%" stopColor="var(--night-moon)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--night-sky-top)" stopOpacity="0" />
            </radialGradient>
            {/* 地表の霧 */}
            <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--night-haze-top)" />
              <stop offset="100%" stopColor="var(--night-haze-bottom)" />
            </linearGradient>
            {/* 影 */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.45" />
            </filter>
            {/* 道のやわらかさ */}
            <filter id="softPath" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.4" />
            </filter>
            {/* 道の薄い影（トーン調整） */}
            <filter id="pathSoftShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
            {/* ランタン（チェックポイント） */}
            <symbol id="lantern" viewBox="-6 -10 12 20">
              <path d="M-3,-7 h6 v3 a3,3 0 0 1 -6,0 z" fill="#1c2b3d" />
              <rect x="-2.2" y="-2.5" width="4.4" height="5.5" rx="1" fill="#0e1c2c" stroke="#20364f" strokeWidth="0.4" />
              <circle cx="0" cy="0.2" r="1.6" fill="#ffdd88" />
            </symbol>
          </defs>
          <motion.g style={{ transform: cameraTransformCss, willChange: 'transform' }}>
          {/* ====== 背景 ====== */}
          <rect width="800" height="600" fill="url(#sky)" />
          {/* 星（静的配置でhydration問題を回避） */}
          {[...Array(80)].map((_, i) => {
            // 完全に決定論的な位置計算
            const seedA = (i * 97 + 13) % 800;
            const seedB = (i * 53 + 7) % 280 + 10;
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
          {/* 追加演出: 月グローと星のきらめき（既存要素の直前に重ねる） */}
          {(() => {
            const peak = Math.max(0, Math.min(1, (progress - 0.85) / 0.15));
            const glowOpacity = 0.35 + peak * 0.35;
            return (
              <motion.rect x="0" y="0" width="800" height="600" fill="url(#moonGlow)" initial={{ opacity: 0.35 }} animate={{ opacity: prefersReducedMotion ? 0.35 : glowOpacity }} />
            );
          })()}
          {[...Array(30)].map((_, i) => {
            const cx = (i * 137 + 23) % 800;
            const cy = (i * 59 + 11) % 280 + 10;
            const r = i % 4 === 0 ? 1.8 : i % 3 === 0 ? 1.4 : 1;
            if (prefersReducedMotion) return <circle key={i} cx={cx} cy={cy} r={r} fill="var(--night-star)" opacity={0.6} />;
            return (
              <motion.circle key={i} cx={cx} cy={cy} r={r} fill="var(--night-star)" initial={{ opacity: 0.55 }} animate={{ opacity: [0.55, 0.9, 0.55] }} transition={{ duration: 2 + (i % 3) * 0.9, delay: (i % 5) * 0.4, repeat: Infinity }} />
            );
          })}
          {/* 月の色味をCSS変数に寄せる（既存の上に重ねる） */}
          <circle cx="150" cy="80" r={35} fill="var(--night-moon)" />

          <g style={parallax(12)}>
            <path d="M0,420 C120,380 240,370 380,380 C520,390 640,350 800,300 L800,600 L0,600 Z" fill="var(--night-ridge-far)" opacity="0.7" />
            <path d="M220,390 L300,300 L360,390 Z" fill="var(--night-ridge-far)" opacity="0.75" />
            <path d="M520,400 L590,310 L660,400 Z" fill="var(--night-ridge-far)" opacity="0.72" />
          </g>
          <g style={parallax(24)}>
            <path d="M0,480 C160,440 300,430 470,420 C620,410 720,370 800,340 L800,600 L0,600 Z" fill="var(--night-ridge-mid)" />
          </g>
          <g style={parallax(42)}>
            <path d="M0,540 C180,510 340,505 520,495 C670,485 740,460 800,445 L800,600 L0,600 Z" fill="var(--night-ridge-near)" />
          </g>
          {/* 追加の近景レイヤ */}
          <g style={parallax(56)}>
            <path d="M0,560 C160,540 320,535 520,525 C680,515 760,500 800,490 L800,600 L0,600 Z" fill="var(--night-ridge-near)" opacity="0.9" />
          </g>
          <rect x="0" y="480" width="800" height="120" fill="url(#haze)" />

          {/* ====== ベースの道（山の後ろにある淡い道） ====== */}
          <path d={TRAIL_D} fill="none" stroke="var(--night-path-shadow)" strokeWidth={9} strokeLinecap="round" filter="url(#pathSoftShadow)" opacity={0.85} />
          <path d={TRAIL_D} fill="none" stroke="var(--night-path-base)" strokeWidth={7} strokeLinecap="round" filter="url(#softPath)" />

          {/* ====== 前景の山（道の輪郭に沿って配置 - 明るい色調） ====== */}
          <g>
            {/* 道の下側の山々（道の輪郭の下） */}
            <path d="M0,600 L80,580 L160,530 L240,510 L320,480 L400,450 L480,420 L560,380 L640,340 L720,200 L800,150 L800,600 Z" fill="var(--night-ridge-front-lower)" />
            
            {/* 道の上側の山々（道の輪郭の上） */}
            <path d="M0,500 L100,480 L200,450 L300,420 L400,390 L500,360 L600,320 L700,280 L760,110 L800,110 L800,500 L700,320 L600,350 L500,380 L400,410 L300,440 L200,470 L100,500 Z" fill="var(--night-ridge-front-upper)" />
            
            {/* 主峰（最終目標地点） */}
            <path d="M700,600 L750,200 L760,110 L780,100 L800,120 L800,600 Z" fill="var(--night-ridge-peak)" />
            
            {/* 道沿いの岩場 */}
            <path d="M150,600 L180,520 L220,500 L250,520 L280,600 Z" fill="var(--night-ridge-rock)" />
            <path d="M450,600 L480,430 L520,410 L550,430 L580,600 Z" fill="var(--night-ridge-rock)" />
            {/* 近景の松のシルエット */}
            <g>
              <path d="M70,520 l20,-40 l20,40 l-10,0 l14,26 l-68,0 l14,-26 z" fill="#0d2235" opacity="0.9" />
              <path d="M120,540 l18,-36 l18,36 l-9,0 l12,22 l-60,0 l12,-22 z" fill="#0d2235" opacity="0.85" />
            </g>
          </g>

          {/* ====== オーバーペイントの"進捗ハイライトの道"（最前面） ====== */}
          <motion.path
            ref={pathRef}
            d={TRAIL_D}
            fill="none"
            stroke="var(--night-path-highlight)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dash}
            style={{ strokeDashoffset: dashOffset }}
            filter="url(#softPath)"
            pointerEvents="none"
          />

          {/* ====== チェックポイント ====== */}
          {cps.map((c, i) => (
            prefersReducedMotion ? (
              <g key={c.p} transform={`translate(${c.x}, ${c.y})`}>
                <use href="#lantern" x={-6} y={-10} width={12} height={20} />
              </g>
            ) : (
              <motion.g
                key={c.p}
                transform={`translate(${c.x}, ${c.y})`}
                animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.04, 1] }}
                transition={{ duration: 2.2 + (i % 3) * 0.6, repeat: Infinity }}
              >
                <use href="#lantern" x={-6} y={-10} width={12} height={20} />
              </motion.g>
            )
          ))}

          {/* ====== ハイカー（最前面） ====== */}
          <g transform={`translate(${pose.x}, ${pose.y}) rotate(${pose.angle})`} filter="url(#shadow)">
            <image href="/hiker_silhouette.svg" width="60" height="72" x={-30} y={-60} preserveAspectRatio="xMidYMid meet" />
          </g>
          </motion.g>
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
