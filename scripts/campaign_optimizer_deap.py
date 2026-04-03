#!/usr/bin/env python3
"""
AG campagne (DEAP) — même objectif que api-opti Rust : maximiser Σ h[i] sous |I|=budget.
Entrée stdin JSON :
  { "h": [float, ...], "budget": int, "generations": int, "population": int, "seed": int }

Sortie stdout JSON :
  { "ok": true, "indices": [int, ...], "fitness": float, "method": "deap_ga" }

Indépendant de la base ; utile pour calibration scientifique ou CI sans PostgreSQL.
"""
from __future__ import annotations

import json
import random
import sys
from typing import Any, Dict, List, Tuple


def main() -> int:
    try:
        payload: Dict[str, Any] = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": str(e)}), file=sys.stderr)
        return 1

    h = [float(x) for x in payload.get("h") or []]
    n = len(h)
    if n < 2:
        print(json.dumps({"ok": False, "error": "h must have length >= 2"}), file=sys.stderr)
        return 2
    budget = int(payload.get("budget") or 1)
    k = max(1, min(budget, n))
    ngen = int(payload.get("generations") or 40)
    mu = int(payload.get("population") or 50)
    seed = int(payload.get("seed") or 42)
    random.seed(seed)

    try:
        from deap import base, creator, tools
    except ImportError:
        print(json.dumps({"ok": False, "error": "pip install deap numpy"}), file=sys.stderr)
        return 3

    try:
        creator.create("FitnessMax", base.Fitness, weights=(1.0,))
    except RuntimeError:
        pass
    try:
        creator.create("Individual", list, fitness=creator.FitnessMax)
    except RuntimeError:
        pass

    toolbox = base.Toolbox()
    def ind_init():
        bits = [0] * n
        idx = list(range(n))
        random.shuffle(idx)
        for i in idx[:k]:
            bits[i] = 1
        if sum(bits) != k:
            for i in range(n):
                bits[i] = 1 if i < k else 0
        return creator.Individual(bits)

    def fitness(ind: List[int]) -> Tuple[float]:
        if sum(ind) != k:
            return (-1e9,)
        return (sum(h[i] for i in range(n) if ind[i]),)

    toolbox.register("individual", ind_init)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)
    toolbox.register("evaluate", fitness)
    toolbox.register("select", tools.selTournament, tournsize=3)

    def repair(ind: List[int]) -> None:
        s = sum(ind)
        idx_one = [i for i in range(n) if ind[i]]
        idx_zero = [i for i in range(n) if not ind[i]]
        while s > k and idx_one:
            j = random.choice(idx_one)
            ind[j] = 0
            idx_one.remove(j)
            idx_zero.append(j)
            s -= 1
        while s < k and idx_zero:
            j = random.choice(idx_zero)
            ind[j] = 1
            idx_zero.remove(j)
            idx_one.append(j)
            s += 1

    def cx_safe(p1, p2):
        c1, c2 = toolbox.clone(p1), toolbox.clone(p2)
        tools.cxUniform(c1, c2, indpb=0.5)
        repair(c1)
        repair(c2)
        return c1, c2

    def mut_safe(ind):
        tools.mutFlipBit(ind, indpb=min(0.35, 4.0 / max(n, 1)))
        repair(ind)
        return (ind,)

    toolbox.register("mate", cx_safe)
    toolbox.register("mutate", mut_safe)

    pop = toolbox.population(n=mu)
    elite = max(2, mu // 10)

    for ind in pop:
        ind.fitness.values = toolbox.evaluate(ind)

    for _ in range(ngen):
        pop.sort(key=lambda x: x.fitness.values[0], reverse=True)
        nxt = list(map(toolbox.clone, pop[:elite]))
        while len(nxt) < mu:
            p1, p2 = map(toolbox.clone, random.sample(pop, 2))
            c1, c2 = toolbox.mate(p1, p2)
            if random.random() < 0.25:
                toolbox.mutate(c1)
            if random.random() < 0.25:
                toolbox.mutate(c2)
            c1.fitness.values = toolbox.evaluate(c1)
            c2.fitness.values = toolbox.evaluate(c2)
            nxt.append(c1)
            if len(nxt) < mu:
                nxt.append(c2)
        pop = nxt[:mu]

    best = max(pop, key=lambda x: x.fitness.values[0])
    idx_sel = [i for i in range(n) if best[i]]
    idx_sel.sort(key=lambda i: h[i], reverse=True)
    out = {
        "ok": True,
        "indices": idx_sel,
        "fitness": float(best.fitness.values[0]),
        "method": "deap_ga",
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
