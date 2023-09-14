import type { Architecture } from "./google-cloud/images";

export default function startupScript({
  api_key,
  project_id,
  gpu,
  arch,
  hostname,
}: {
  api_key?: string;
  project_id?: string;
  gpu?: boolean;
  arch: Architecture;
  hostname: string;
}) {
  if (!api_key) {
    throw Error("api_key must be specified");
  }
  if (!project_id) {
    throw Error("project_id must be specified");
  }
  return `
#!/bin/bash

${runCoCalcCompute({ api_key, project_id, gpu, arch, hostname })}
`;
}

/* The additional flags beyond just '--gpus all' are because Nvidia's tensorflow
   image says this on startup:

NOTE: The SHMEM allocation limit is set to the default of 64MB.  This may be
insufficient for TensorFlow.  NVIDIA recommends the use of the following flags:
docker run --gpus all --ipc=host --ulimit memlock=-1 --ulimit stack=67108864 ...
*/
const GPU_FLAGS =
  " --gpus all --ipc=host --ulimit memlock=-1 --ulimit stack=67108864 ";

// TODO: we could set the hostname in a more useful way!

function runCoCalcCompute({ api_key, project_id, gpu, arch, hostname }) {
  return `
docker run  ${gpu ? GPU_FLAGS : ""} \
   --name=base \
   --hostname="${hostname}" \
   -e API_KEY=${api_key} \
   -e PROJECT_ID=${project_id} \
   --privileged \
   --mount type=bind,source=/home,target=/home,bind-propagation=rshared \
   -v /var/run/docker.sock:/var/run/docker.sock \
   sagemathinc/compute${arch == "arm64" ? "-arm64" : ""}
 `;
}
