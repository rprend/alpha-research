# Prime Qwen 3B SSH Preflight Attempt

Generated: 2026-06-27T15:47:21.861Z

Status: `failed_after_pod_creation_ssh_denied`

Prime auth and wallet access were repaired for team `Zenobia Pay`. A Massed Compute `RTX6000Ada_48GB x1` pod was created with image `ubuntu_22_cuda_12`, but SSH preflight failed with publickey/password denial before repo sync or training. The pod was terminated immediately.

## Cost

- Wallet billing id: `8f7ea3d804ce49deb8a8f8efc970a757`
- Wallet debit: `$0.0192`
- External compute total after attempt: `$0.0192`
- Total tracked spend after attempt: `$5.915585600000015`
- Remaining budget: `$94.08441439999999`

## Outcome

No Qwen training ran. No predictions, smoke manifest, remote environment, or OpenAI judge artifacts were created. This is operational evidence only, not model-quality evidence.

## Required Change

The Prime runbook now requires SSH preflight immediately after pod status capture and before repo sync or training. If SSH fails, terminate the pod and record the wallet debit before any further launch attempt.

Prime's CLI documentation says SSH keys are managed from the dashboard profile and the CLI should point at the matching private key path. The likely next fix is to add the public key for `/Users/ryanprendergast/.ssh/id_rsa.pub` to the Prime dashboard profile, or create a dedicated Prime SSH key there and run `prime config set-ssh-key-path <private-key-path>`.
