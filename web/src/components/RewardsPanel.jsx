export default function RewardsPanel({ rewards, rewardForm, setRewardForm, onCreate, onRedeem }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm">
      <h2 className="mb-3 text-xl font-semibold">Rewards</h2>
      <form onSubmit={onCreate} className="flex flex-wrap gap-2">
        <input
          className="min-w-56 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
          placeholder="Reward name"
          value={rewardForm.name}
          onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
        />
        <input
          className="w-28 rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
          type="number"
          min={1}
          value={rewardForm.cost_points}
          onChange={(e) => setRewardForm({ ...rewardForm, cost_points: e.target.value })}
        />
        <button type="submit" className="rounded-md border border-indigo-500 bg-indigo-500 px-4 py-2 font-medium text-white">
          Add Reward
        </button>
      </form>
      {rewards.map((reward) => (
        <div className="flex items-center justify-between gap-2 border-t border-slate-700 py-3 first:border-t-0 first:pt-0" key={reward.id}>
          <span>
            {reward.name} ({reward.cost_points} pts)
          </span>
          <button className="rounded-md border border-emerald-500 bg-emerald-600 px-3 py-2 text-sm font-medium text-white" onClick={() => onRedeem(reward.id)}>
            Redeem
          </button>
        </div>
      ))}
    </section>
  );
}
