class EnemyManager {
    constructor(laneMinX, laneMaxX) {
        this.laneMinX = laneMinX;
        this.laneMaxX = laneMaxX;
        this.enemies = [];

        // 敵の定義データ (種類ごとのパラメータ)
        this.definitions = {
            normal: {
                color: '#ff5252',
                size: 22 * 0.7,
                baseSpeed: 3
            },
            circle: {
                color: '#ab47bc',
                size: (22 * 0.7) * 1.35 * 1.2,
                baseSpeed: 1.5,
                rotSpeed: 0.02
            },
            bar: {
                color: '#2196F3',
                width: 16,
                height: 56,
                size: 28, // 当たり判定用
                speed: 10,
                waitTime: 180
            },
            star: {
                color: '#ffa726', // 橙色
                size: 24,
                baseSpeed: 1.2,
                spawnInterval: 180 // 定期的に子機を産む間隔（フレーム）
            }
        };
    }

    clear() {
        this.enemies = [];
    }

    spawn(elapsedSeconds, level, starWeight = 0) {
        const intervalsPassed = Math.floor(elapsedSeconds / 10);
        const baseHp = Math.max(2, Math.round(2 * Math.pow(1.1, intervalsPassed)));
        const minutesPassed = Math.floor(elapsedSeconds / 60);
        
        const barWeight = Math.min(70, minutesPassed * 10);
        const circleWeight = Math.min(50, 10 + minutesPassed * 10);
        const normalWeight = 100;
        const totalWeight = normalWeight + circleWeight + barWeight + starWeight;

        const randomVal = Math.random() * totalWeight;
        const spawnX = this.laneMinX + Math.random() * (this.laneMaxX - this.laneMinX);

        if (randomVal < starWeight) {
            // 星型の敵（ゆっくり斜めに移動、通常の2倍HP、定期的に子機を生む）
            const def = this.definitions.star;
            // 斜め移動の方向（ランダムで左右どちらかへ傾ける）
            const vx = (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.5);
            this.enemies.push({
                type: 'star',
                x: spawnX,
                y: -40,
                vx: vx,
                size: def.size,
                speed: def.baseSpeed,
                hp: baseHp * 2, // 通常の2倍のHP
                maxHp: baseHp * 2,
                spawnTimer: def.spawnInterval
            });
        } else if (randomVal < starWeight + barWeight) {
            const def = this.definitions.bar;
            this.enemies.push({
                type: 'bar',
                x: spawnX,
                y: 30,
                width: def.width,
                height: def.height,
                size: def.size,
                speed: def.speed,
                hp: baseHp + 2,
                maxHp: baseHp + 2,
                state: 'waiting',
                timer: def.waitTime
            });
        } else if (randomVal < starWeight + barWeight + circleWeight) {
            const def = this.definitions.circle;
            this.enemies.push({
                type: 'circle',
                x: spawnX,
                y: -40,
                size: def.size,
                // 丸型の敵の速度を70%に調整
                speed: ((def.baseSpeed + Math.random() * 1.5 + (level - 1) * 0.15) * 0.5) * 0.7,
                hp: baseHp * 2,
                maxHp: baseHp * 2,
                rotation: 0,
                rotSpeed: def.rotSpeed
            });
        } else {
            const def = this.definitions.normal;
            this.enemies.push({
                type: 'normal',
                x: spawnX,
                y: -30,
                size: def.size,
                // 三角の敵の速度を70%に調整
                speed: (def.baseSpeed + Math.random() * 1.5 + (level - 1) * 0.15) * 0.7,
                hp: baseHp,
                maxHp: baseHp
            });
        }
    }

    update(playerY, onReachBottom, onSpawnMini) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let en = this.enemies[i];

            // 挙動処理
            if (en.type === 'bar') {
                if (en.state === 'waiting') {
                    en.timer--;
                    if (en.timer <= 0) en.state = 'dropping';
                } else {
                    en.y += en.speed;
                }
            } else if (en.type === 'star') {
                en.x += en.vx;
                en.y += en.speed;
                // 画面端での反射処理
                if (en.x < this.laneMinX || en.x > this.laneMaxX) {
                    en.vx *= -1;
                }
                // 定期的に丸型の小さな敵（HP1）を生み出す
                en.spawnTimer--;
                if (en.spawnTimer <= 0) {
                    en.spawnTimer = this.definitions.star.spawnInterval;
                    if (onSpawnMini) {
                        onSpawnMini(en.x, en.y);
                    }
                }
            } else {
                en.y += en.speed;
                if (en.type === 'circle') {
                    en.rotation += en.rotSpeed;
                }
            }

            // 画面下部に到達したか
            if (en.y > playerY + 30) {
                onReachBottom();
                return;
            }
        }
    }

    draw(ctx) {
        for (let en of this.enemies) {
            if (en.type === 'bar') {
                ctx.save();
                let renderX = en.x;
                let renderY = en.y;
                if (en.state === 'waiting') {
                    renderX += (Math.random() - 0.5) * 4;
                    renderY += (Math.random() - 0.5) * 4;
                }

                ctx.fillStyle = this.definitions.bar.color;
                ctx.fillRect(renderX - en.width / 2, renderY, en.width, en.height);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(renderX - en.width / 2, renderY, en.width, en.height);

                const eyeX = renderX + 2;
                for (let ey = renderY + 12; ey < renderY + en.height - 8; ey += 14) {
                    ctx.beginPath();
                    ctx.arc(eyeX, ey, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(eyeX, ey + 1.2, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#000';
                    ctx.fill();
                }
                ctx.restore();

            } else if (en.type === 'star') {
                // 星型の描画
                ctx.save();
                ctx.translate(en.x, en.y);
                ctx.fillStyle = this.definitions.star.color;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                for (let j = 0; j < 5; j++) {
                    const angle = (j * 2 * Math.PI) / 5 - Math.PI / 2;
                    const innerAngle = angle + Math.PI / 5;
                    const rOuter = en.size;
                    const rInner = en.size * 0.45;
                    
                    const xOuter = Math.cos(angle) * rOuter;
                    const yOuter = Math.sin(angle) * rOuter;
                    const xInner = Math.cos(innerAngle) * rInner;
                    const yInner = Math.sin(innerAngle) * rInner;

                    if (j === 0) ctx.moveTo(xOuter, yOuter);
                    else ctx.lineTo(xOuter, yOuter);
                    ctx.lineTo(xInner, yInner);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // 中央にふたつの目玉
                const eyeDist = 6;
                const eyeY = -2;
                for (let offsetX of [-eyeDist, eyeDist]) {
                    ctx.beginPath();
                    ctx.arc(offsetX, eyeY, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(offsetX, eyeY + 1, 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#000';
                    ctx.fill();
                }
                ctx.restore();

            } else if (en.type === 'circle') {
                ctx.save();
                ctx.translate(en.x, en.y);
                ctx.rotate(en.rotation);

                ctx.fillStyle = this.definitions.circle.color;
                ctx.beginPath();
                ctx.arc(0, 0, en.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                const eyeDist = en.size * 0.35;
                const eyeY = -en.size * 0.15;
                for (let offsetX of [-eyeDist, eyeDist]) {
                    ctx.beginPath();
                    ctx.arc(offsetX, eyeY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(offsetX, eyeY, 1.8, 0, Math.PI * 2);
                    ctx.fillStyle = '#000';
                    ctx.fill();
                }
                ctx.restore();
            } else {
                ctx.fillStyle = this.definitions.normal.color;
                ctx.beginPath();
                ctx.moveTo(en.x - en.size, en.y - en.size);
                ctx.lineTo(en.x + en.size, en.y - en.size);
                ctx.lineTo(en.x, en.y + en.size);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                const eyeY = en.y - 2;
                for (let offsetX of [-3.5, 3.5]) {
                    ctx.beginPath();
                    ctx.arc(en.x + offsetX, eyeY, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#fff';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(en.x + offsetX, eyeY + 1, 1.2, 0, Math.PI * 2);
                    ctx.fillStyle = '#000';
                    ctx.fill();
                }
            }

            // HPバー描画
            if (en.hp < en.maxHp || en.maxHp > 2) {
                const barW = 20, barH = 3;
                let topY = (en.type === 'bar') ? en.y : (en.y - en.size);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(en.x - barW / 2, topY - 8, barW, barH);
                ctx.fillStyle = '#4CAF50';
                ctx.fillRect(en.x - barW / 2, topY - 8, barW * Math.max(0, en.hp / en.maxHp), barH);
            }
        }
    }
}