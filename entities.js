// entities.js - 完全修正版

class Seed {
  constructor(x, y, parentType = null) {
    this.x = x;
    this.y = y;
    this.type = parentType || (Math.random() < 0.5 ? 'small' : 'large');
    this.age = 0;
    this.isGerminated = false;
  }

  update() {
    this.age++;
    if (this.age >= SEED_GERMINATION_TIME) {
      const { col, row } = getGridCell(this.x, this.y);
      if (soilGrid[row][col] >= 10.0) {
        const hasNearbyPlant = plants.some(p => {
          const dx = p.x - this.x;
          const dy = p.y - this.y;
          return (dx * dx + dy * dy) <= 100;
        });

        if (!hasNearbyPlant) {
          plants.push(new Plant(this.x, this.y, this.type));
          soilGrid[row][col] -= 2.0;
          this.isGerminated = true;
        }
      }
    }
  }

  draw() {
    simCtx.fillStyle = '#D7CCC8';
    simCtx.beginPath();
    simCtx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    simCtx.fill();

    if (this.age >= SEED_GERMINATION_TIME) {
      simCtx.strokeStyle = this.type === 'small' ? '#A5D6A7' : '#2E7D32';
      simCtx.lineWidth = 1.5;
      simCtx.beginPath();
      simCtx.arc(this.x, this.y, 3.5, 0, Math.PI * 2);
      simCtx.stroke();
    }
  }
}

class Plant {
  constructor(x, y, type = null) {
    this.x = x || Math.random() * (simCanvas.width - 20) + 10;
    this.y = y || Math.random() * (simCanvas.height - 20) + 10;
    this.type = type || (Math.random() < 0.5 ? 'small' : 'large');

    if (this.type === 'small') {
      this.hp = 1.5;
      this.maxHp = 18.0; // 3倍
      this.color = '#A5D6A7';
    } else {
      this.hp = 3.0;
      this.maxHp = 54.0; // 3倍
      this.color = '#1B5E20';
    }
  }

  get size() {
    return Math.max(1.5, this.hp * 0.35);
  }

  update() {
    const { col, row } = getGridCell(this.x, this.y);
    const availableSoil = soilGrid[row][col];

    if (this.hp < this.maxHp && availableSoil > 0) {
      const growth = Math.min(Params.plantGrowth, availableSoil, this.maxHp - this.hp);
      this.hp += growth;
      soilGrid[row][col] -= growth;
    } else if (this.hp >= this.maxHp && availableSoil >= 5.0) {
      if (Math.random() < 0.015 && (plants.length + seeds.length) < 500) {
        const spreadDistance = 50;
        // 画面端を越えたらループ
        let newX = (this.x + (Math.random() - 0.5) * spreadDistance + simCanvas.width) % simCanvas.width;
        let newY = (this.y + (Math.random() - 0.5) * spreadDistance + simCanvas.height) % simCanvas.height;
        
        seeds.push(new Seed(newX, newY, this.type));
        soilGrid[row][col] -= 1.0;
      }
    }
  }

  draw() {
    simCtx.fillStyle = this.color;
    simCtx.beginPath();
    simCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    simCtx.fill();
  }
}

class Herbivore {
  constructor(x, y, initialCooldown = 0, type = null) {
    this.x = x || Math.random() * (simCanvas.width - 40) + 20;
    this.y = y || Math.random() * (simCanvas.height - 40) + 20;
    this.isDead = false;
    this.breedCooldown = initialCooldown;
    this.age = 0;
    
    this.type = type || (Math.random() < 0.5 ? 'large' : 'small');
    if (this.type === 'large') {
      this.hp = 180;
      this.maxHp = 180;
      this.corpseMaxHp = 100;
      this.speedMultiplier = 0.6;
      this.size = 8;
    } else {
      this.hp = 60;
      this.maxHp = 60;
      this.corpseMaxHp = 40;
      this.speedMultiplier = 1.4;
      this.size = 5;
    }
    
    const angle = Math.random() * Math.PI * 2;
    const speed = Params.herbSpeed * this.speedMultiplier;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(aliveCount) {
    if (this.isDead) {
      const decayRate = 0.08;
      this.hp -= decayRate;
      addNutrient(this.x, this.y, decayRate);
      return;
    }

    this.age++;
    if (this.breedCooldown > 0) this.breedCooldown--;

    const agingFactor = 1 + (this.age * 0.0003);
    const hpLoss = Params.herbHpLoss * agingFactor;
    
    this.hp -= hpLoss;
    addNutrient(this.x, this.y, hpLoss);

    if (Math.random() < 0.005 && (plants.length + seeds.length) < 500) {
      seeds.push(new Seed(this.x, this.y));
    }

    // 死亡処理（種子ドロップ含む）
    if (this.hp <= 0) {
      this.isDead = true;
      this.vx = 0;
      this.vy = 0;

      const dropCount = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < dropCount; i++) {
        if ((plants.length + seeds.length) < 500) {
          let dropX = (this.x + (Math.random() - 0.5) * 30 + simCanvas.width) % simCanvas.width;
          let dropY = (this.y + (Math.random() - 0.5) * 30 + simCanvas.height) % simCanvas.height;
          seeds.push(new Seed(dropX, dropY));
        }
      }
      return;
    }

    let forceX = 0, forceY = 0;
    let nearestCarnivore = null;
    let minCarnSq = (Params.herbVision * 1.2) ** 2;

    for (let i = 0; i < carnivores.length; i++) {
      const c = carnivores[i];
      if (c.type === 'typeA') {
        const dx = c.x - this.x;
        const dy = c.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minCarnSq) {
          minCarnSq = distSq;
          nearestCarnivore = c;
        }
      }
    }

    if (nearestCarnivore) {
      const fleeX = this.x - nearestCarnivore.x;
      const fleeY = this.y - nearestCarnivore.y;
      const len = Math.hypot(fleeX, fleeY) || 1;
      forceX += (fleeX / len) * 2.5;
      forceY += (fleeY / len) * 2.5;
    } else {
      const visionSq = Params.herbVision ** 2;
      if (this.hp < this.maxHp * 0.8) {
        let nearestPlant = null;
        let minPlantSq = visionSq;

        for (let i = 0; i < plants.length; i++) {
          const p = plants[i];
          const dx = p.x - this.x;
          const dy = p.y - this.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minPlantSq) {
            minPlantSq = distSq;
            nearestPlant = p;
          }
        }

        if (nearestPlant) {
          const eatX = nearestPlant.x - this.x;
          const eatY = nearestPlant.y - this.y;
          const len = Math.hypot(eatX, eatY) || 1;
          forceX += (eatX / len) * 1.2;
          forceY += (eatY / len) * 1.2;

          const minDist = this.size + Math.max(4, nearestPlant.size);
          if (minPlantSq < minDist * minDist) {
            const neededHp = this.maxHp - this.hp;
            if (neededHp > 0) {
              const biteAmount = this.maxHp * 0.2;
              const eatAmount = Math.min(neededHp, nearestPlant.hp, biteAmount);
              this.hp += eatAmount;
              nearestPlant.hp -= eatAmount;
            }
          }
        }
      }

      let sepX = 0, sepY = 0;
      let alignX = 0, alignY = 0;
      let cohX = 0, cohY = 0;
      let flockCount = 0;
      const personalSpace = this.size * 2.8;
      const personalSpaceSq = personalSpace * personalSpace;

      for (let i = 0; i < herbivores.length; i++) {
        const other = herbivores[i];
        if (other === this || other.isDead) continue;
        
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < personalSpaceSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const pushFactor = (personalSpace - dist) / personalSpace;
          sepX -= (dx / dist) * pushFactor * 3.0;
          sepY -= (dy / dist) * pushFactor * 3.0;
        }

        if (distSq < visionSq) {
          alignX += other.vx;
          alignY += other.vy;
          cohX += other.x;
          cohY += other.y;
          flockCount++;
        }
      }

      forceX += sepX;
      forceY += sepY;

      if (flockCount > 0 && Params.flockWeight > 0) {
        alignX /= flockCount;
        alignY /= flockCount;
        const alignLen = Math.hypot(alignX, alignY) || 1;
        forceX += (alignX / alignLen) * 0.5 * Params.flockWeight;

        cohX = (cohX / flockCount) - this.x;
        cohY = (cohY / flockCount) - this.y;
        const cohLen = Math.hypot(cohX, cohY) || 1;
        forceX += (cohX / cohLen) * 0.6 * Params.flockWeight;
      }
    }

    if (Math.abs(forceX) > 0.01 || Math.abs(forceY) > 0.01) {
      this.vx += forceX * 0.15;
      this.vy += forceY * 0.15;
    } else {
      this.vx += (Math.random() - 0.5) * 0.3;
      this.vy += (Math.random() - 0.5) * 0.3;
    }

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    const baseSpeed = Params.herbSpeed * this.speedMultiplier;
    const ageSpeedDebuff = 1 / (1 + this.age * 0.0005);
    
    const currentMaxSpeed = baseSpeed * (1 + (1 - hpRatio) * 0.8) * ageSpeedDebuff;
    const currentSpeed = Math.hypot(this.vx, this.vy) || 1;
    
    this.vx = (this.vx / currentSpeed) * currentMaxSpeed;
    this.vy = (this.vy / currentSpeed) * currentMaxSpeed;

    // 移動と画面端ループ
    this.x = (this.x + this.vx + simCanvas.width) % simCanvas.width;
    this.y = (this.y + this.vy + simCanvas.height) % simCanvas.height;

    if (this.hp > this.maxHp * 0.9 && this.breedCooldown <= 0 && aliveCount < 180) {
      this.hp -= this.maxHp * 0.4;
      this.breedCooldown = BREED_COOLDOWN_FRAMES;

      const isMutated = Math.random() < 0.05;
      const childType = isMutated ? (this.type === 'large' ? 'small' : 'large') : this.type;

      herbivores.push(new Herbivore(
        this.x + (Math.random() - 0.5) * 10,
        this.y + (Math.random() - 0.5) * 10,
        BREED_COOLDOWN_FRAMES,
        childType
      ));
    }
  }

  draw() {
    if (this.isDead) {
      simCtx.fillStyle = '#78909C';
      simCtx.beginPath();
      simCtx.arc(this.x, this.y, this.size - 1, 0, Math.PI * 2);
      simCtx.fill();

      simCtx.fillStyle = '#424242';
      simCtx.fillRect(this.x - 6, this.y - 8, 12, 2);
      simCtx.fillStyle = '#B0BEC5';
      simCtx.fillRect(this.x - 6, this.y - 8, 12 * Math.max(0, this.hp / this.corpseMaxHp), 2);
      return;
    }

    simCtx.fillStyle = this.type === 'large' ? '#1E88E5' : '#64B5F6';
    simCtx.beginPath();
    simCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    simCtx.fill();

    simCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(this.x, this.y);
    simCtx.lineTo(this.x + this.vx * 3, this.y + this.vy * 3);
    simCtx.stroke();

    simCtx.fillStyle = '#ff0000';
    simCtx.fillRect(this.x - 8, this.y - 10, 16, 2);
    simCtx.fillStyle = '#00ff00';
    simCtx.fillRect(this.x - 8, this.y - 10, 16 * Math.max(0, this.hp / this.maxHp), 2);
  }
}

class Carnivore {
  constructor(x, y, initialCooldown = 0, speciesType = null) {
    this.x = x || Math.random() * (simCanvas.width - 40) + 20;
    this.y = y || Math.random() * (simCanvas.height - 40) + 20;
    this.hp = 120;
    this.maxHp = 180;
    this.breedCooldown = initialCooldown;
    this.age = 0;
    
    this.type = speciesType || (Math.random() < 0.5 ? 'typeA' : 'typeC');
    
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * Params.carnSpeed;
    this.vy = Math.sin(angle) * Params.carnSpeed;
    this.size = 9;
  }

  getColor() {
    return this.type === 'typeA' ? '#FF80AB' : '#8B0000';
  }

  mutateType() {
    this.type = this.type === 'typeA' ? 'typeC' : 'typeA';
  }

  update() {
    this.age++;
    if (this.breedCooldown > 0) this.breedCooldown--;

    const agingFactor = 1 + (this.age * 0.0003);
    const hpLoss = Params.carnHpLoss * agingFactor;

    this.hp -= hpLoss;
    addNutrient(this.x, this.y, hpLoss);

    if (this.hp < this.maxHp * 0.6 && Math.random() < 0.002) {
      this.mutateType();
    }

    // 死亡処理（種子ドロップ含む）
    if (this.hp <= 0) {
      const dropCount = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < dropCount; i++) {
        if ((plants.length + seeds.length) < 500) {
          let dropX = (this.x + (Math.random() - 0.5) * 40 + simCanvas.width) % simCanvas.width;
          let dropY = (this.y + (Math.random() - 0.5) * 40 + simCanvas.height) % simCanvas.height;
          seeds.push(new Seed(dropX, dropY));
        }
      }
      return;
    }

    let forceX = 0, forceY = 0;

    if (this.type === 'typeA') {
      let nearestRed = null;
      let minRedSq = (Params.carnVision * 1.2) ** 2;
      for (let i = 0; i < carnivores.length; i++) {
        const c = carnivores[i];
        if (c.type === 'typeC') {
          const dx = c.x - this.x;
          const dy = c.y - this.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minRedSq) {
            minRedSq = distSq;
            nearestRed = c;
          }
        }
      }
      if (nearestRed) {
        const fleeX = this.x - nearestRed.x;
        const fleeY = this.y - nearestRed.y;
        const len = Math.hypot(fleeX, fleeY) || 1;
        forceX += (fleeX / len) * 2.5;
        forceY += (fleeY / len) * 2.5;
      }
    }

    const personalSpace = this.size * 3.0;
    const personalSpaceSq = personalSpace * personalSpace;
    for (let i = 0; i < carnivores.length; i++) {
      const other = carnivores[i];
      if (other === this) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < personalSpaceSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const pushFactor = (personalSpace - dist) / personalSpace;
        forceX -= (dx / dist) * pushFactor * 3.5;
        forceY -= (dy / dist) * pushFactor * 3.5;
      }
    }

    if (this.hp < this.maxHp * 0.85) {
      let nearestPrey = null;
      let minDistanceSq = Params.carnVision ** 2;

      if (this.type === 'typeA') {
        for (let i = 0; i < herbivores.length; i++) {
          const h = herbivores[i];
          if (h.isDead) continue;
          const dx = h.x - this.x;
          const dy = h.y - this.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearestPrey = h;
          }
        }
      } else if (this.type === 'typeC') {
        for (let i = 0; i < carnivores.length; i++) {
          const c = carnivores[i];
          if (c.type === 'typeA') {
            const dx = c.x - this.x;
            const dy = c.y - this.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              nearestPrey = c;
            }
          }
        }
      }

      if (nearestPrey) {
        const chaseX = nearestPrey.x - this.x;
        const chaseY = nearestPrey.y - this.y;
        const len = Math.hypot(chaseX, chaseY) || 1;
        forceX += (chaseX / len) * 2.0;
        forceY += (chaseY / len) * 2.0;

        const minDist = this.size + nearestPrey.size;
        if (minDistanceSq < minDist * minDist) {
          const neededHp = this.maxHp - this.hp;
          if (neededHp > 0) {
            const biteAmount = this.maxHp * 0.2;
            const eatAmount = Math.min(neededHp, nearestPrey.hp, biteAmount);
            
            this.hp += eatAmount;
            nearestPrey.hp -= eatAmount;
            addNutrient(this.x, this.y, eatAmount * 0.1);
          }
        }
      }
    }

    if (Math.abs(forceX) > 0.01 || Math.abs(forceY) > 0.01) {
      this.vx += forceX * 0.15;
      this.vy += forceY * 0.15;
    } else {
      this.vx += (Math.random() - 0.5) * 0.3;
      this.vy += (Math.random() - 0.5) * 0.3;
    }

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    const ageSpeedDebuff = 1 / (1 + this.age * 0.0005);
    const hpBoost = (this.type === 'typeA') ? 2.4 : 1.6;
    
    const currentMaxSpeed = Params.carnSpeed * (1 + (1 - hpRatio) * hpBoost) * ageSpeedDebuff;
    const currentSpeed = Math.hypot(this.vx, this.vy) || 1;

    this.vx = (this.vx / currentSpeed) * currentMaxSpeed;
    this.vy = (this.vy / currentSpeed) * currentMaxSpeed;

    // 移動と画面端ループ
    this.x = (this.x + this.vx + simCanvas.width) % simCanvas.width;
    this.y = (this.y + this.vy + simCanvas.height) % simCanvas.height;

    if (this.hp > 160 && this.breedCooldown <= 0 && carnivores.length < 70) {
      this.hp -= 70;
      this.breedCooldown = CARNIVORE_BREED_COOLDOWN_FRAMES;
      carnivores.push(new Carnivore(
        this.x + (Math.random() - 0.5) * 10,
        this.y + (Math.random() - 0.5) * 10,
        CARNIVORE_BREED_COOLDOWN_FRAMES,
        this.type
      ));
    }
  }

  draw() {
    simCtx.fillStyle = this.getColor();
    simCtx.beginPath();
    simCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    simCtx.fill();

    simCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(this.x, this.y);
    simCtx.lineTo(this.x + this.vx * 3, this.y + this.vy * 3);
    simCtx.stroke();

    simCtx.fillStyle = '#ff0000';
    simCtx.fillRect(this.x - 10, this.y - 12, 20, 2);
    simCtx.fillStyle = '#00ff00';
    simCtx.fillRect(this.x - 10, this.y - 12, 20 * Math.max(0, this.hp / this.maxHp), 2);
  }
}